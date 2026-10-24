"""Shared request guards and helpers for the routers."""

from typing import List, Optional

from fastapi import HTTPException

from ..config import settings
from ..services import services
from ..vector_store import VectorStore


def session_documents(store: VectorStore, document_name: Optional[str] = None) -> Optional[List[str]]:
    """The session's documents, narrowed to document_name when it is one of them"""
    names = list(store.document_summaries().keys()) or None
    if document_name and names and document_name in names:
        return [document_name]
    return names


def require_documents(store: VectorStore) -> None:
    if not store.has_documents():
        raise HTTPException(status_code=400, detail="No documents uploaded yet. Please upload a document first.")


def require_own_conversation(conversation_id: str, session_id: str) -> None:
    """404 for conversations that don't exist or belong to another session"""
    if conversation_id and conversation_id != "default" and not services.conversations.owns(conversation_id, session_id):
        raise HTTPException(status_code=404, detail="Conversation not found")


def require_self(user_id: str, session_id: str) -> None:
    if user_id != session_id:
        raise HTTPException(status_code=403, detail="You can only access your own data")


def require_debug_endpoints() -> None:
    """Operational endpoints (cost money or list other users' sessions) are off unless enabled"""
    if not settings.enable_debug_endpoints:
        raise HTTPException(status_code=404, detail="Not Found")
