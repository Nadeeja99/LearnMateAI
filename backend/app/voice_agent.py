"""
Voice Agent System for LearnMate AI
Handles real-time voice interaction with PDF analysis
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import io
import base64

# Import our existing modules
from .rag_chain import RAGChain
from .vector_store import VectorStore
from .conversation_memory import conversation_memory
from .learning_analytics import learning_analytics
from .voice_processing import VoiceProcessingService, voice_processing_service

logger = logging.getLogger(__name__)

class VoiceAgent:
    """Real-time voice agent for PDF analysis and interaction"""
    
    def __init__(self, rag_chain: RAGChain, voice_processing_service: VoiceProcessingService):
        self.rag_chain = rag_chain
        self.voice_processing = voice_processing_service
        self.active_connections: Dict[str, WebSocket] = {}
        self.conversation_contexts: Dict[str, Dict[str, Any]] = {}
        
    async def connect(self, websocket: WebSocket, client_id: str):
        """Handle new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.conversation_contexts[client_id] = {
            "conversation_id": None,
            "user_id": "default",
            "last_interaction": datetime.now(),
            "voice_enabled": True
        }
        logger.info(f"Voice agent connected: {client_id}")
        
        # Send welcome message
        await self.send_voice_response(
            client_id, 
            "Hello! I'm your voice learning assistant. I can help you analyze and discuss your uploaded documents. What would you like to know?",
            "welcome"
        )
    
    async def disconnect(self, client_id: str):
        """Handle WebSocket disconnection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.conversation_contexts:
            del self.conversation_contexts[client_id]
        logger.info(f"Voice agent disconnected: {client_id}")
    
    async def process_voice_message(self, client_id: str, audio_data: str, message_type: str = "voice"):
        """Process incoming voice message"""
        try:
            if client_id not in self.active_connections:
                logger.warning(f"No active connection for client: {client_id}")
                return
            
            logger.info(f"Processing voice message for client: {client_id}")
            
            # Convert base64 audio to text using OpenAI Whisper
            transcribed_text = await self.speech_to_text(audio_data)
            
            logger.info(f"Transcribed text: '{transcribed_text}'")
            
            if not transcribed_text:
                logger.warning("No transcribed text received")
                await self.send_voice_response(
                    client_id, 
                    "I'm sorry, I couldn't understand what you said. Could you please try again?",
                    "error"
                )
                return
            
            # Send transcribed text to frontend first
            logger.info(f"Sending transcribed text to frontend: '{transcribed_text}'")
            await self.send_transcribed_text(client_id, transcribed_text)
            
            # Update conversation context
            context = self.conversation_contexts.get(client_id, {})
            context["last_interaction"] = datetime.now()
            
            # Process the transcribed text through RAG system
            response = await self.process_text_query(client_id, transcribed_text)
            
            # Send voice response
            await self.send_voice_response(client_id, response["answer"], "response")
            
            # Track analytics
            if learning_analytics:
                learning_analytics.track_session(
                    user_id=context.get("user_id", "default"),
                    session_type="voice_chat",
                    document_name=None,
                    duration_seconds=0,
                    metadata={
                        "transcribed_text": transcribed_text,
                        "response_length": len(response["answer"]),
                        "conversation_id": response.get("conversation_id"),
                        "voice_enabled": True
                    }
                )
                
        except Exception as e:
            logger.error(f"Error processing voice message: {e}")
            await self.send_voice_response(
                client_id, 
                "I'm sorry, I encountered an error processing your request. Please try again.",
                "error"
            )
    
    async def speech_to_text(self, audio_data: str) -> str:
        """Convert audio to text using OpenAI Whisper API"""
        try:
            if not self.voice_processing:
                logger.error("Voice processing service not initialized")
                return None
            
            transcribed_text = await self.voice_processing.speech_to_text(audio_data)
            
            if transcribed_text:
                logger.info(f"Successfully transcribed: {transcribed_text[:50]}...")
                return transcribed_text
            else:
                logger.warning("Speech-to-text returned empty result")
                return None
                
        except Exception as e:
            logger.error(f"Error in speech-to-text: {e}")
            return None
    
    async def text_to_speech(self, text: str) -> bytes:
        """Convert text to speech using OpenAI TTS API"""
        try:
            if not self.voice_processing:
                logger.error("Voice processing service not initialized")
                return b""
            
            audio_data = await self.voice_processing.text_to_speech(text)
            
            if audio_data:
                logger.info(f"Successfully generated speech for: {text[:50]}...")
                return audio_data
            else:
                logger.warning("Text-to-speech returned empty result")
                return b""
                
        except Exception as e:
            logger.error(f"Error in text-to-speech: {e}")
            return b""
    
    async def process_text_query(self, client_id: str, query: str) -> Dict[str, Any]:
        """Process text query through RAG system"""
        try:
            context = self.conversation_contexts.get(client_id, {})
            user_id = context.get("user_id", "default")
            conversation_id = context.get("conversation_id")
            
            # Create conversation if none exists
            if not conversation_id:
                conversation_id = conversation_memory.create_conversation(
                    user_id=user_id,
                    title=f"Voice Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    document_context=[]
                )
                context["conversation_id"] = conversation_id
                self.conversation_contexts[client_id] = context
            
            # Process through RAG system
            result = await self.rag_chain.answer_question(
                question=query,
                document_names=None,  # Use all documents
                conversation_id=conversation_id,
                user_id=user_id
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing text query: {e}")
            return {
                "answer": "I'm sorry, I couldn't process your question right now. Please try again.",
                "sources": [],
                "conversation_id": conversation_id
            }
    
    async def send_transcribed_text(self, client_id: str, transcribed_text: str):
        """Send transcribed text to frontend to show what user said"""
        try:
            if client_id not in self.active_connections:
                return
            
            websocket = self.active_connections[client_id]
            
            # Send transcribed text
            response = {
                "type": "transcribed",
                "text": transcribed_text,
                "timestamp": datetime.now().isoformat()
            }
            
            await websocket.send_text(json.dumps(response))
            logger.info(f"Sent transcribed text to {client_id}: {transcribed_text[:50]}...")
            
        except Exception as e:
            logger.error(f"Error sending transcribed text: {e}")

    async def send_voice_response(self, client_id: str, text: str, message_type: str = "response"):
        """Send voice response to client"""
        try:
            if client_id not in self.active_connections:
                return
            
            websocket = self.active_connections[client_id]
            
            # Generate audio from text
            audio_data = await self.text_to_speech(text)
            
            # Send response
            response = {
                "type": message_type,
                "text": text,
                "audio": base64.b64encode(audio_data).decode() if audio_data else None,
                "timestamp": datetime.now().isoformat(),
                "conversation_id": self.conversation_contexts.get(client_id, {}).get("conversation_id")
            }
            
            await websocket.send_text(json.dumps(response))
            logger.info(f"Sent voice response to {client_id}: {text[:50]}...")
            
        except Exception as e:
            logger.error(f"Error sending voice response: {e}")
    
    async def handle_websocket_message(self, client_id: str, message: Dict[str, Any]):
        """Handle incoming WebSocket message"""
        try:
            message_type = message.get("type", "voice")
            
            if message_type == "voice":
                audio_data = message.get("audio")
                if audio_data:
                    await self.process_voice_message(client_id, audio_data)
            elif message_type == "text":
                text = message.get("text")
                if text:
                    response = await self.process_text_query(client_id, text)
                    await self.send_voice_response(client_id, response["answer"], "response")
            elif message_type == "ping":
                await self.active_connections[client_id].send_text(json.dumps({"type": "pong"}))
                
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
    
    def get_active_connections_count(self) -> int:
        """Get number of active voice connections"""
        return len(self.active_connections)
    
    def get_connection_info(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get connection information"""
        if client_id in self.conversation_contexts:
            context = self.conversation_contexts[client_id]
            return {
                "client_id": client_id,
                "connected": client_id in self.active_connections,
                "conversation_id": context.get("conversation_id"),
                "last_interaction": context.get("last_interaction"),
                "voice_enabled": context.get("voice_enabled", True)
            }
        return None

# Global voice agent instance (will be initialized in main.py)
voice_agent: Optional[VoiceAgent] = None
