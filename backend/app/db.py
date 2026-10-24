"""
SQLite storage for conversations and analytics.

Replaces the JSON files that were rewritten in full on every write (O(n) per message and
unsafe under concurrent requests). SQLite gives atomic, incremental writes with no extra
service to run; WAL mode lets readers proceed while a write is in progress.
"""

import json
import logging
import os
import sqlite3
import threading
from contextlib import contextmanager
from typing import Any, Iterator, List, Optional, Sequence

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.path = path
        # One shared connection guarded by a lock: some callers run in worker threads
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._lock = threading.RLock()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        """Commit on success, roll back on error."""
        with self._lock, self._conn:
            yield self._conn

    def execute(self, sql: str, params: Sequence[Any] = ()) -> sqlite3.Cursor:
        with self.transaction() as conn:
            return conn.execute(sql, params)

    def query(self, sql: str, params: Sequence[Any] = ()) -> List[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, params).fetchall()

    def query_one(self, sql: str, params: Sequence[Any] = ()) -> Optional[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, params).fetchone()


def to_json(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False, default=str)


def from_json(value: Optional[str], default: Any = None) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def mark_migrated(path: str) -> None:
    """Keep an imported legacy file (renamed) instead of deleting user data."""
    os.replace(path, f"{path}.migrated")
    logger.info(f"Imported legacy data from {path} (kept as {path}.migrated)")


_database: Optional[Database] = None


def get_database() -> Database:
    """The app's shared database (created on first use at settings.database_path)."""
    global _database
    if _database is None:
        from .config import settings
        _database = Database(settings.database_path)
    return _database

