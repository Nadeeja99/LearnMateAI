"""Client configuration and session lifecycle."""

import logging

from fastapi import APIRouter, Depends

from ..config import settings
from ..errors import internal_error
from ..services import services
from ..sessions import require_session_id

logger = logging.getLogger(__name__)
router = APIRouter(tags=["session"])


@router.get("/config")
async def client_config():
    """Limits the UI should enforce, so it never drifts from the server's settings"""
    return {
        "max_upload_size": settings.max_upload_size,
        "max_documents_per_session": settings.max_documents_per_session,
    }


@router.delete("/session")
async def delete_session(session_id: str = Depends(require_session_id)):
    """Erase everything stored for this session: documents, conversations and learning history."""
    try:
        services.session_stores.delete(session_id)
        conversations = services.conversations.delete_user_conversations(session_id)
        sessions = services.analytics.delete_user_data(session_id) if services.analytics else 0
        logger.info(f"Session data deleted ({conversations} conversations, {sessions} analytics events)")
        return {"message": "All your data has been deleted", "deleted": {"conversations": conversations, "analytics_events": sessions}}
    except Exception:
        raise internal_error("Deleting your data")
