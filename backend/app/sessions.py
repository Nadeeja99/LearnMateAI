"""
Anonymous per-browser sessions.

Each browser generates a random session id (stored in localStorage) and sends it as the
X-Session-Id header. Every session gets its own FAISS index on disk, so documents are
isolated by construction: a query can only ever search the caller's own index.
"""

import logging
import os
import re
import shutil
import threading
import time
from collections import OrderedDict
from typing import Optional

from fastapi import Header, HTTPException

from .vector_store import VectorStore

logger = logging.getLogger(__name__)

# The id becomes a directory name, so it must never contain path separators or dots
SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9-]{16,64}$")


def is_valid_session_id(value: Optional[str]) -> bool:
    return bool(value) and SESSION_ID_PATTERN.fullmatch(value) is not None


def require_session_id(x_session_id: Optional[str] = Header(default=None)) -> str:
    """FastAPI dependency: the caller's validated session id"""
    if not is_valid_session_id(x_session_id):
        raise HTTPException(status_code=400, detail="Missing or invalid X-Session-Id header")
    return x_session_id


class SessionStoreRegistry:
    """Lazily loads per-session vector stores, keeping the most recently used in memory."""

    def __init__(self, openai_api_key: str, root_dir: str = "data/sessions", max_loaded: int = 32):
        self.openai_api_key = openai_api_key
        self.root_dir = root_dir
        self.max_loaded = max_loaded
        self._loaded: "OrderedDict[str, VectorStore]" = OrderedDict()
        self._lock = threading.Lock()
        os.makedirs(self.root_dir, exist_ok=True)

    def _session_dir(self, session_id: str) -> str:
        if not is_valid_session_id(session_id):
            raise ValueError("Invalid session id")
        return os.path.join(self.root_dir, session_id)

    def get(self, session_id: str) -> VectorStore:
        """The session's vector store, loaded from disk on first use."""
        with self._lock:
            store = self._loaded.get(session_id)
            if store is None:
                store = VectorStore(self.openai_api_key, store_dir=self._session_dir(session_id))
                self._loaded[session_id] = store
                # Evict from memory only; the index stays on disk and reloads on demand
                while len(self._loaded) > self.max_loaded:
                    self._loaded.popitem(last=False)
            else:
                self._loaded.move_to_end(session_id)
            return store

    def delete(self, session_id: str) -> None:
        """Remove a session's documents from memory and disk."""
        with self._lock:
            self._loaded.pop(session_id, None)
            shutil.rmtree(self._session_dir(session_id), ignore_errors=True)

    def cleanup_expired(self, max_age_days: float) -> int:
        """Delete sessions whose files have not changed in max_age_days. Returns the count removed."""
        if max_age_days <= 0:
            return 0
        cutoff = time.time() - max_age_days * 86400
        removed = 0
        for name in os.listdir(self.root_dir):
            path = os.path.join(self.root_dir, name)
            if not (os.path.isdir(path) and is_valid_session_id(name)):
                continue
            last_modified = max(
                (os.path.getmtime(os.path.join(dirpath, f)) for dirpath, _, files in os.walk(path) for f in files),
                default=os.path.getmtime(path),
            )
            if last_modified < cutoff:
                self.delete(name)
                removed += 1
        if removed:
            logger.info(f"Removed {removed} expired session(s) older than {max_age_days} days")
        return removed
