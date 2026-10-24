"""
In-process sliding-window rate limiting for the endpoints that cost money (LLM, embeddings).

Limits apply per session AND per client IP: session ids are minted by the client, so the
IP limit is what stops one caller from rotating ids to bypass the session limit.

State is per process. That fits the single uvicorn worker this app runs; scaling out to
several workers or instances needs a shared store such as Redis.
"""

import math
import os
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Callable, Deque, Dict, Optional

from fastapi import Depends, HTTPException, Request

from .sessions import require_session_id


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


@dataclass
class RatePolicy:
    name: str
    per_session: SlidingWindowLimiter
    per_ip: SlidingWindowLimiter

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


def _env_int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


AI_POLICY = RatePolicy(
    "AI",
    per_session=SlidingWindowLimiter(_env_int("RATE_LIMIT_AI_PER_MINUTE", 20), 60),
    per_ip=SlidingWindowLimiter(_env_int("RATE_LIMIT_AI_PER_IP_PER_MINUTE", 60), 60),
)
UPLOAD_POLICY = RatePolicy(
    "upload",
    per_session=SlidingWindowLimiter(_env_int("RATE_LIMIT_UPLOADS_PER_HOUR", 20), 3600),
    per_ip=SlidingWindowLimiter(_env_int("RATE_LIMIT_UPLOADS_PER_IP_PER_HOUR", 60), 3600),
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
