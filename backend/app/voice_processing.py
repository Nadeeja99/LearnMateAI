"""
Voice Processing Service for LearnMate AI
Handles speech-to-text and text-to-speech using OpenAI APIs
"""

import os
import logging
import io
import base64
import tempfile
from typing import Optional, Tuple
import openai
import requests

logger = logging.getLogger(__name__)

class VoiceProcessingService:
    """Service for handling voice processing using OpenAI APIs"""
    
    def __init__(self, openai_api_key: str):
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.whisper_model = "whisper-1"
        self.tts_model = "tts-1"
        self.tts_voice = "alloy"  # Options: alloy, echo, fable, onyx, nova, shimmer
        
    async def speech_to_text(self, audio_data: str) -> Optional[str]:
        """
        Convert audio to text using OpenAI Whisper API
        
        Args:
            audio_data: Base64 encoded audio data
            
        Returns:
            Transcribed text or None if failed
        """
        try:
            # Decode base64 audio
            audio_bytes = base64.b64decode(audio_data)
            
            # Create temporary file for audio
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            try:
                # Transcribe using Whisper (it can handle webm format)
                with open(temp_file_path, "rb") as audio_file:
                    transcript = self.openai_client.audio.transcriptions.create(
                        model=self.whisper_model,
                        file=audio_file,
                        language="en"  # Specify language for better accuracy
                    )
                
                transcribed_text = transcript.text.strip()
                logger.info(f"Speech-to-text successful: {transcribed_text[:50]}...")
                
                return transcribed_text
                
            finally:
                # Clean up temporary files
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"Error in speech-to-text: {e}")
            return None
    
    async def text_to_speech(self, text: str) -> Optional[bytes]:
        """
        Convert text to speech using OpenAI TTS API
        
        Args:
            text: Text to convert to speech
            
        Returns:
            Audio data as bytes or None if failed
        """
        try:
            # Generate speech using OpenAI TTS
            response = self.openai_client.audio.speech.create(
                model=self.tts_model,
                voice=self.tts_voice,
                input=text,
                speed=1.0  # Normal speed
            )
            
            # Get audio data
            audio_data = response.content
            
            logger.info(f"Text-to-speech successful: {text[:50]}...")
            return audio_data
            
        except Exception as e:
            logger.error(f"Error in text-to-speech: {e}")
            return None
    
    def get_available_voices(self) -> list:
        """Get list of available TTS voices"""
        return [
            {"id": "alloy", "name": "Alloy", "description": "Neutral, clear voice"},
            {"id": "echo", "name": "Echo", "description": "Male voice"},
            {"id": "fable", "name": "Fable", "description": "British accent"},
            {"id": "onyx", "name": "Onyx", "description": "Deep, authoritative voice"},
            {"id": "nova", "name": "Nova", "description": "Young, energetic voice"},
            {"id": "shimmer", "name": "Shimmer", "description": "Soft, gentle voice"}
        ]
    
    def set_voice(self, voice_id: str):
        """Set the TTS voice"""
        available_voices = [v["id"] for v in self.get_available_voices()]
        if voice_id in available_voices:
            self.tts_voice = voice_id
            logger.info(f"TTS voice set to: {voice_id}")
        else:
            logger.warning(f"Invalid voice ID: {voice_id}")
    
    async def test_voice_processing(self) -> dict:
        """Test voice processing capabilities"""
        try:
            # Test TTS
            test_text = "Hello, this is a test of the voice processing system."
            audio_data = await self.text_to_speech(test_text)
            
            return {
                "status": "success",
                "tts_working": audio_data is not None,
                "available_voices": self.get_available_voices(),
                "current_voice": self.tts_voice,
                "test_audio_generated": len(audio_data) if audio_data else 0
            }
            
        except Exception as e:
            logger.error(f"Error testing voice processing: {e}")
            return {
                "status": "error",
                "error": str(e),
                "tts_working": False,
                "available_voices": [],
                "current_voice": None,
                "test_audio_generated": 0
            }

# Global voice processing service (will be initialized in main.py)
voice_processing_service: Optional[VoiceProcessingService] = None
