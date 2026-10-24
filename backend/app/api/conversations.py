"""Conversation history, private to the session that created it."""

from fastapi import APIRouter, Depends

from ..errors import internal_error
from ..models import CreateConversationRequest
from ..services import services
from ..sessions import require_session_id
from .deps import require_own_conversation, require_self

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("")
async def create_conversation(body: CreateConversationRequest, session_id: str = Depends(require_session_id)):
    """Create a new conversation owned by the caller's session"""
    try:
        conversation_id = services.conversations.create_conversation(
            user_id=session_id, title=body.title, document_context=body.document_context
        )
        return {"conversation_id": conversation_id, "message": "Conversation created successfully"}
    except Exception:
        raise internal_error("Creating the conversation")


@router.get("/{conversation_id}/history")
async def get_conversation_history(conversation_id: str, limit: int = 10, session_id: str = Depends(require_session_id)):
    """Get conversation history"""
    require_own_conversation(conversation_id, session_id)
    try:
        return {
            "conversation_id": conversation_id,
            "history": services.conversations.get_conversation_history(conversation_id, limit),
            "context": services.conversations.get_conversation_context(conversation_id),
        }
    except Exception:
        raise internal_error("Loading the conversation")


@router.get("/user/{user_id}")
async def get_user_conversations(user_id: str, limit: int = 20, session_id: str = Depends(require_session_id)):
    """Get all conversations for a user (only the caller's own)"""
    require_self(user_id, session_id)
    try:
        return {"user_id": user_id, "conversations": services.conversations.get_user_conversations(user_id, limit)}
    except Exception:
        raise internal_error("Loading conversations")


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, session_id: str = Depends(require_session_id)):
    """Delete a conversation"""
    require_own_conversation(conversation_id, session_id)
    try:
        services.conversations.delete_conversation(conversation_id)
        return {"message": f"Conversation {conversation_id} deleted successfully"}
    except Exception:
        raise internal_error("Deleting the conversation")
