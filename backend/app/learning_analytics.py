"""
Learning Analytics System for LearnMate AI
Tracks user progress, learning patterns, and performance metrics (SQLite-backed)

Progress (totals, streaks, last activity) is derived from the recorded sessions on read,
rather than kept as mutable counters, so it can't drift out of sync with the history.
"""

import json
import logging
import os
import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from .config import settings
from .db import Database, from_json, get_database, mark_migrated, to_json

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS learning_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_type TEXT NOT NULL,
    document_name TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user ON learning_sessions (user_id, timestamp);
CREATE TABLE IF NOT EXISTS performance_metrics (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    value REAL NOT NULL,
    timestamp TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_time ON performance_metrics (timestamp);
"""

# "question" is the legacy name for chat turns; voice turns are questions too
CHAT_TYPES = {"chat", "question"}
QUESTION_TYPES = CHAT_TYPES | {"voice_chat"}


def learning_streak(active_days: Iterable[date], today: date) -> int:
    """Consecutive active days ending today (or yesterday, so an unfinished day doesn't reset it)."""
    days = set(active_days)
    day = today if today in days else today - timedelta(days=1)
    streak = 0
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


def _distributions(rows) -> Dict[str, Dict[str, int]]:
    session_types, document_types, daily = Counter(), Counter(), Counter()
    for row in rows:
        session_types[row["session_type"]] += 1
        if row["document_name"]:
            document_types[row["document_name"].rsplit(".", 1)[-1].lower()] += 1
        daily[row["timestamp"][:10]] += 1
    return {"session_types": dict(session_types), "document_types": dict(document_types), "daily": dict(sorted(daily.items()))}


def _most_common(counts: Dict[str, int]) -> Optional[str]:
    return max(counts.items(), key=lambda item: item[1])[0] if counts else None


class LearningAnalytics:
    """Manages learning analytics and user progress tracking"""

    def __init__(self, db: Database, legacy_dir: Optional[str] = None):
        self.db = db
        with self.db.transaction() as conn:
            conn.executescript(SCHEMA)
        if legacy_dir:
            self._import_legacy_json(legacy_dir)

    def _import_legacy_json(self, legacy_dir: str) -> None:
        """One-time import of the pre-SQLite JSON files"""
        sessions_file = os.path.join(legacy_dir, "sessions.json")
        metrics_file = os.path.join(legacy_dir, "performance_metrics.json")
        progress_file = os.path.join(legacy_dir, "user_progress.json")  # now derived; nothing to import
        try:
            if os.path.exists(sessions_file):
                with open(sessions_file, encoding="utf-8") as f:
                    sessions = json.load(f)
                with self.db.transaction() as conn:
                    conn.executemany(
                        "INSERT OR IGNORE INTO learning_sessions VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [(s["id"], s["user_id"], s["session_type"], s.get("document_name"), s.get("duration_seconds", 0),
                          s["timestamp"], to_json(s.get("metadata"))) for s in sessions],
                    )
                mark_migrated(sessions_file)
            if os.path.exists(metrics_file):
                with open(metrics_file, encoding="utf-8") as f:
                    metrics = json.load(f)
                with self.db.transaction() as conn:
                    conn.executemany(
                        "INSERT INTO performance_metrics (metric_name, value, timestamp, context) VALUES (?, ?, ?, ?)",
                        [(m["metric_name"], m["value"], m["timestamp"], to_json(m.get("context"))) for m in metrics],
                    )
                mark_migrated(metrics_file)
            if os.path.exists(progress_file):
                mark_migrated(progress_file)
        except Exception as e:
            logger.error(f"Could not import legacy analytics from {legacy_dir}: {e}")

    def track_session(self, user_id: str, session_type: str, document_name: str = None,
                      duration_seconds: int = 0, metadata: Dict[str, Any] = None):
        """Track a learning session"""
        self.db.execute(
            "INSERT INTO learning_sessions VALUES (?, ?, ?, ?, ?, ?, ?)",
            (f"session_{uuid.uuid4().hex}", user_id, session_type, document_name, duration_seconds,
             datetime.now().isoformat(), to_json(metadata)),
        )
        logger.info(f"Tracked session: {session_type}")

    def get_user_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive analytics for a user ({} if they have no activity yet)"""
        rows = self.db.query("SELECT * FROM learning_sessions WHERE user_id = ? ORDER BY timestamp", (user_id,))
        if not rows:
            return {}

        dist = _distributions(rows)
        types = dist["session_types"]
        hours = Counter(datetime.fromisoformat(r["timestamp"]).hour for r in rows)
        active_days = {datetime.fromisoformat(r["timestamp"]).date() for r in rows}

        return {
            "user_id": user_id,
            "total_sessions": len(rows),
            "total_documents_uploaded": types.get("upload", 0),
            "total_questions_asked": sum(types.get(t, 0) for t in QUESTION_TYPES),
            "total_summaries_generated": types.get("summary", 0),
            "total_quizzes_taken": types.get("quiz", 0),
            "total_chat_messages": sum(types.get(t, 0) for t in CHAT_TYPES),
            "learning_streak_days": learning_streak(active_days, date.today()),
            "last_activity": rows[-1]["timestamp"],
            "session_types_distribution": types,
            "document_types_distribution": dist["document_types"],
            "daily_activity": dist["daily"],
            "learning_patterns": {
                "most_active_hour": hours.most_common(1)[0][0],
                "preferred_session_type": _most_common(types),
                "average_sessions_per_day": len(rows) / len(active_days),
            },
        }

    def get_global_analytics(self) -> Dict[str, Any]:
        """Get global analytics across all users (aggregates only, no user ids)"""
        rows = self.db.query("SELECT * FROM learning_sessions")
        users: Dict[str, set] = {}
        for row in rows:
            users.setdefault(row["user_id"], set()).add(datetime.fromisoformat(row["timestamp"]).date())

        if not rows:
            return {"total_users": 0, "total_sessions": 0}

        dist = _distributions(rows)
        today = date.today()
        return {
            "total_users": len(users),
            "total_sessions": len(rows),
            "average_sessions_per_user": len(rows) / len(users),
            "average_learning_streak": sum(learning_streak(days, today) for days in users.values()) / len(users),
            "session_types_distribution": dist["session_types"],
            "document_types_distribution": dist["document_types"],
            "daily_activity": dist["daily"],
            "most_popular_session_type": _most_common(dist["session_types"]),
            "most_popular_document_type": _most_common(dist["document_types"]),
        }

    def add_performance_metric(self, metric_name: str, value: float, context: Dict[str, Any] = None):
        """Add a performance metric"""
        self.db.execute(
            "INSERT INTO performance_metrics (metric_name, value, timestamp, context) VALUES (?, ?, ?, ?)",
            (metric_name, value, datetime.now().isoformat(), to_json(context)),
        )
        logger.info(f"Added performance metric: {metric_name} = {value}")

    def get_performance_metrics(self, metric_name: str = None, days: int = 30) -> List[Dict[str, Any]]:
        """Get performance metrics"""
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        sql = "SELECT * FROM performance_metrics WHERE timestamp >= ?"
        params: List[Any] = [cutoff]
        if metric_name:
            sql += " AND metric_name = ?"
            params.append(metric_name)
        return [
            {
                "metric_name": r["metric_name"],
                "value": r["value"],
                "timestamp": r["timestamp"],
                # Metrics are public; user ids are session ids and must not leak (older records stored them)
                "context": {k: v for k, v in from_json(r["context"], {}).items() if k != "user_id"},
            }
            for r in self.db.query(sql + " ORDER BY seq", params)
        ]

    def cleanup_old_data(self, days_old: int = 90):
        """Clean up old analytics data"""
        cutoff = (datetime.now() - timedelta(days=days_old)).isoformat()
        with self.db.transaction() as conn:
            sessions = conn.execute("DELETE FROM learning_sessions WHERE timestamp < ?", (cutoff,)).rowcount
            metrics = conn.execute("DELETE FROM performance_metrics WHERE timestamp < ?", (cutoff,)).rowcount
        if sessions or metrics:
            logger.info(f"Cleaned up {sessions} old sessions and {metrics} old metrics")


# Global learning analytics instance (shares the app database)
learning_analytics = LearningAnalytics(get_database(), legacy_dir=os.path.join(settings.data_dir, "analytics"))
