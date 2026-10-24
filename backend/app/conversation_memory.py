"""
Conversation Memory System for LearnMate AI
Provides persistent conversation history and context awareness (SQLite-backed)
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from .config import settings
from .db import Database, from_json, get_database, mark_migrated, to_json

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    document_context TEXT NOT NULL DEFAULT '[]',
    summary TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations (user_id, updated_at);
CREATE TABLE IF NOT EXISTS messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, seq);
"""


class ConversationMemory:
    """Manages conversation memory and context"""

    def __init__(self, db: Database, legacy_dir: Optional[str] = None):
        self.db = db
        with self.db.transaction() as conn:
            conn.executescript(SCHEMA)
        if legacy_dir:
            self._import_legacy_json(os.path.join(legacy_dir, "conversations.json"))

    def _import_legacy_json(self, path: str) -> None:
        """One-time import of the pre-SQLite conversations.json"""
        if not os.path.exists(path):
            return
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            with self.db.transaction() as conn:
                for conv in data.values():
                    conn.execute(
                        "INSERT OR IGNORE INTO conversations VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (conv["id"], conv["user_id"], conv["title"], conv["created_at"], conv["updated_at"],
                         json.dumps(conv.get("document_context") or []), conv.get("summary")),
                    )
                    for msg in conv.get("messages", []):
                        conn.execute(
                            "INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                            (msg["id"], conv["id"], msg["role"], msg["content"], msg["timestamp"], to_json(msg.get("metadata"))),
                        )
            mark_migrated(path)
        except Exception as e:
            logger.error(f"Could not import legacy conversations from {path}: {e}")

    def create_conversation(self, user_id: str, title: str = None, document_context: List[str] = None) -> str:
        """Create a new conversation"""
        now = datetime.now()
        # Random suffix, never the user id: user ids are session ids, which act as credentials
        conv_id = f"conv_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:12]}"
        self.db.execute(
            "INSERT INTO conversations (id, user_id, title, created_at, updated_at, document_context) VALUES (?, ?, ?, ?, ?, ?)",
            (conv_id, user_id, title or f"Conversation {now.strftime('%Y-%m-%d %H:%M')}", now.isoformat(), now.isoformat(),
             json.dumps(document_context or [])),
        )
        logger.info(f"Created new conversation: {conv_id}")
        return conv_id

    def add_message(self, conversation_id: str, role: str, content: str, metadata: Dict[str, Any] = None) -> str:
        """Add a message to a conversation"""
        now = datetime.now()
        message_id = f"msg_{now.strftime('%Y%m%d_%H%M%S_%f')}"
        with self.db.transaction() as conn:
            updated = conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now.isoformat(), conversation_id))
            if updated.rowcount == 0:
                raise ValueError(f"Conversation {conversation_id} not found")
            conn.execute(
                "INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (message_id, conversation_id, role, content, now.isoformat(), to_json(metadata)),
            )
        logger.info(f"Added message to conversation {conversation_id}")
        return message_id

    def get_conversation_history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent conversation history (oldest first)"""
        rows = self.db.query(
            "SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT ?) ORDER BY seq",
            (conversation_id, limit if limit else -1),
        )
        return [
            {"id": r["id"], "role": r["role"], "content": r["content"], "timestamp": r["timestamp"], "metadata": from_json(r["metadata"], {})}
            for r in rows
        ]

    def owns(self, conversation_id: str, user_id: str) -> bool:
        """True if the conversation exists and belongs to user_id"""
        return self.db.query_one("SELECT 1 FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id)) is not None

    def get_conversation_context(self, conversation_id: str) -> Dict[str, Any]:
        """Get conversation context for AI"""
        row = self.db.query_one(
            "SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count "
            "FROM conversations c WHERE c.id = ?",
            (conversation_id,),
        )
        if row is None:
            return {}
        return {
            "conversation_id": conversation_id,
            "title": row["title"],
            "document_context": from_json(row["document_context"], []),
            "message_count": row["message_count"],
            "last_updated": row["updated_at"],
            "summary": row["summary"],
        }

    def get_user_conversations(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get all conversations for a user, most recently updated first"""
        rows = self.db.query(
            "SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count "
            "FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT ?",
            (user_id, limit),
        )
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "message_count": r["message_count"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "document_context": from_json(r["document_context"], []),
                "summary": r["summary"],
            }
            for r in rows
        ]

    def update_conversation_summary(self, conversation_id: str, summary: str):
        """Update conversation summary"""
        self.db.execute(
            "UPDATE conversations SET summary = ?, updated_at = ? WHERE id = ?", (summary, datetime.now().isoformat(), conversation_id)
        )

    def delete_conversation(self, conversation_id: str):
        """Delete a conversation and its messages"""
        self.db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        logger.info(f"Deleted conversation {conversation_id}")

    def cleanup_old_conversations(self, days_old: int = 30):
        """Clean up conversations not updated in days_old days"""
        cutoff = (datetime.now() - timedelta(days=days_old)).isoformat()
        removed = self.db.execute("DELETE FROM conversations WHERE updated_at < ?", (cutoff,)).rowcount
        if removed:
            logger.info(f"Cleaned up {removed} old conversations")


# Global conversation memory instance (shares the app database)
conversation_memory = ConversationMemory(get_database(), legacy_dir=os.path.join(settings.data_dir, "conversations"))
