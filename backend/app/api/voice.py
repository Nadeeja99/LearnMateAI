"""Real-time voice chat over WebSocket, plus voice status endpoints."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status

from ..errors import internal_error
from ..logging_setup import new_request_id, request_id_var
from ..rate_limit import AI_POLICY
from ..services import services
from ..sessions import is_valid_session_id
from .deps import require_debug_endpoints

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])


@router.websocket("/ws/{client_id}")
async def websocket_voice_endpoint(websocket: WebSocket, client_id: str, session_id: str = ""):
    """WebSocket endpoint for real-time voice interaction.

    Browsers can't set headers on WebSockets, so the session id comes as ?session_id=.
    """
    if not is_valid_session_id(session_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    request_id_var.set(new_request_id())  # correlate this connection's log lines
    voice_agent = services.voice_agent
    try:
        await voice_agent.connect(websocket, client_id, session_id)
        while True:
            try:
                message = json.loads(await websocket.receive_text())

                # Each voice/text turn runs Whisper + LLM + TTS, so it counts against the AI limit
                if message.get("type") in ("voice", "text"):
                    try:
                        AI_POLICY.check(session_id, websocket.client.host if websocket.client else "unknown")
                    except HTTPException as limited:
                        await websocket.send_text(json.dumps({"type": "error", "text": limited.detail, "message": limited.detail}))
                        continue

                await voice_agent.handle_websocket_message(client_id, message)
            except WebSocketDisconnect:
                logger.info(f"Client {client_id} disconnected from voice agent")
                break
            except Exception:
                logger.exception("Error handling WebSocket message")
                await websocket.send_text(json.dumps({"type": "error", "message": "An error occurred processing your request"}))
    except Exception:
        logger.exception("WebSocket connection error")
    finally:
        await voice_agent.disconnect(client_id)


@router.get("/status")
async def get_voice_agent_status():
    """Get voice agent status"""
    try:
        return {
            "status": "active",
            "active_connections": services.voice_agent.get_active_connections_count(),
            "voice_enabled": True,
            "features": ["real_time_voice_chat", "pdf_analysis", "conversation_memory", "analytics_tracking"],
        }
    except Exception:
        raise internal_error("Loading voice status")


@router.get("/connections", dependencies=[Depends(require_debug_endpoints)])
async def get_voice_connections():
    """Get information about active voice connections (debug only)"""
    try:
        agent = services.voice_agent
        connections = [info for client_id in agent.active_connections if (info := agent.get_connection_info(client_id))]
        return {"active_connections": connections, "total_connections": len(connections)}
    except Exception:
        raise internal_error("Loading voice connections")


@router.get("/test", dependencies=[Depends(require_debug_endpoints)])
async def test_voice_processing():
    """Test voice processing capabilities (debug only; calls the paid TTS API)"""
    try:
        return await services.voice_processing.test_voice_processing()
    except Exception:
        raise internal_error("Testing voice processing")


@router.get("/voices")
async def get_available_voices():
    """Get available TTS voices"""
    try:
        return {
            "available_voices": services.voice_processing.get_available_voices(),
            "current_voice": services.voice_processing.tts_voice,
        }
    except Exception:
        raise internal_error("Loading voices")
