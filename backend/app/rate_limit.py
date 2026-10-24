"""
In-process sliding-window rate limiting for the endpoints that cost money (LLM, embeddings).

Limits apply per session AND per client IP: session ids are minted by the client, so the
IP limit is what stops one caller from rotating ids to bypass the session limit.

By default state lives in this process, which fits a single uvicorn worker. Set REDIS_URL to
share limits across several workers or instances (e.g. when scaling out on Render).
"""

import logging
import math
import threading
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Callable, Deque, Dict, Optional, Union

from fastapi import Depends, HTTPException, Request

from .config import settings
from .sessions import require_session_id

logger = logging.getLogger(__name__)


class SlidingWindowLimiter:
    """Allows at most `limit` hits per key within any `window_seconds` interval."""

    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window_seconds
        self.clock = clock
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def retry_after(self, key: str) -> Optional[float]:
        """Seconds until `key` may hit again, or None if it may hit now (without recording)."""
        if self.limit <= 0:
            return None  # disabled
        with self._lock:
            hits = self._prune(key)
            return None if len(hits) < self.limit else hits[0] + self.window - self.clock()

    def record(self, key: str) -> None:
        if self.limit <= 0:
            return
        with self._lock:
            self._prune(key).append(self.clock())
            if len(self._hits) > 10_000:  # bound memory: drop idle keys
                for idle in [k for k, v in self._hits.items() if not v or v[-1] < self.clock() - self.window]:
                    del self._hits[idle]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def _prune(self, key: str) -> Deque[float]:
        hits = self._hits[key]
        cutoff = self.clock() - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()
        return hits


class RedisSlidingWindowLimiter:
    """Same contract as SlidingWindowLimiter, with hits stored in Redis so every worker shares them.

    Each key is a sorted set of hit timestamps (wall clock, comparable across machines). Check and
    record are separate round trips, so concurrent requests can overshoot by a request or two;
    that is acceptable for cost protection. If Redis is unreachable the limiter fails open (logs
    and allows) rather than turning a Redis outage into an app outage.
    """

    def __init__(self, client: Any, prefix: str, limit: int, window_seconds: float, clock: Callable[[], float] = time.time):
        self.client = client
        self.prefix = prefix
        self.limit = limit
        self.window = window_seconds
        self.clock = clock

    def _key(self, key: str) -> str:
        return f"ratelimit:{self.prefix}:{key}"

    def retry_after(self, key: str) -> Optional[float]:
        if self.limit <= 0:
            return None
        try:
            now, redis_key = self.clock(), self._key(key)
            pipe = self.client.pipeline()
            pipe.zremrangebyscore(redis_key, 0, now - self.window)
            pipe.zcard(redis_key)
            pipe.zrange(redis_key, 0, 0, withscores=True)
            _, count, oldest = pipe.execute()
            if count < self.limit:
                return None
            return oldest[0][1] + self.window - now if oldest else self.window
        except Exception:
            logger.exception("Rate limiter: Redis unavailable, allowing request")
            return None

    def record(self, key: str) -> None:
        if self.limit <= 0:
            return
        try:
            now, redis_key = self.clock(), self._key(key)
            pipe = self.client.pipeline()
            pipe.zadd(redis_key, {f"{now}:{uuid.uuid4().hex[:8]}": now})  # unique member per hit
            pipe.expire(redis_key, math.ceil(self.window) + 1)  # idle keys clean themselves up
            pipe.execute()
        except Exception:
            logger.exception("Rate limiter: Redis unavailable, hit not recorded")

    def reset(self) -> None:
        try:
            for redis_key in self.client.scan_iter(match=f"ratelimit:{self.prefix}:*"):
                self.client.delete(redis_key)
        except Exception:
            logger.exception("Rate limiter: Redis unavailable, reset skipped")


Limiter = Union[SlidingWindowLimiter, RedisSlidingWindowLimiter]


def make_limiter(prefix: str, limit: int, window_seconds: float, redis_client: Any = None) -> Limiter:
    """Redis-backed when a client is given (shared across workers), in-memory otherwise."""
    if redis_client is not None:
        return RedisSlidingWindowLimiter(redis_client, prefix, limit, window_seconds)
    return SlidingWindowLimiter(limit, window_seconds)


def _redis_client() -> Any:
    if not settings.redis_url:
        return None
    import redis  # only needed when REDIS_URL is configured
    from redis.backoff import NoBackoff
    from redis.retry import Retry

    logger.info("Rate limits are shared via Redis")
    # No retries: when Redis is down we fail open immediately instead of stalling every request
    return redis.Redis.from_url(settings.redis_url, socket_timeout=0.5, socket_connect_timeout=0.5, retry=Retry(NoBackoff(), 0))


@dataclass
class RatePolicy:
    name: str
    per_session: Limiter
    per_ip: Limiter

    def check(self, session_id: str, client_ip: str) -> None:
        """Raise 429 if either limit is exhausted; otherwise record the hit against both."""
        waits = [w for w in (self.per_session.retry_after(session_id), self.per_ip.retry_after(client_ip)) if w is not None]
        if waits:
            seconds = max(1, math.ceil(max(waits)))
            raise HTTPException(
                status_code=429,
                detail=f"Too many {self.name} requests. Please wait {seconds}s and try again.",
                headers={"Retry-After": str(seconds)},
            )
        self.per_session.record(session_id)
        self.per_ip.record(client_ip)


_redis = _redis_client()
AI_POLICY = RatePolicy(
    "AI",
    per_session=make_limiter("ai:session", settings.rate_limit_ai_per_minute, 60, _redis),
    per_ip=make_limiter("ai:ip", settings.rate_limit_ai_per_ip_per_minute, 60, _redis),
)
UPLOAD_POLICY = RatePolicy(
    "upload",
    per_session=make_limiter("upload:session", settings.rate_limit_uploads_per_hour, 3600, _redis),
    per_ip=make_limiter("upload:ip", settings.rate_limit_uploads_per_ip_per_hour, 3600, _redis),
)


def reset_all() -> None:
    for policy in (AI_POLICY, UPLOAD_POLICY):
        policy.per_session.reset()
        policy.per_ip.reset()


def client_ip(request: Request) -> str:
    # Behind a proxy (Render), uvicorn's --proxy-headers rewrites request.client from
    # X-Forwarded-For; we deliberately don't parse that header ourselves (it is spoofable).
    return request.client.host if request.client else "unknown"


def _limited(policy: RatePolicy):
    def dependency(request: Request, session_id: str = Depends(require_session_id)) -> str:
        policy.check(session_id, client_ip(request))
        return session_id

    return dependency


# Drop-in replacements for Depends(require_session_id) on costly endpoints
ai_rate_limited = _limited(AI_POLICY)
upload_rate_limited = _limited(UPLOAD_POLICY)
