"""
LangFuse configuration and client setup for LearnMate AI
Provides observability and tracing for RAG operations
"""

import os
import logging
from typing import Optional
from langfuse import Langfuse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class LangfuseConfig:
    """LangFuse configuration and client management"""
    
    def __init__(self):
        self.enabled = os.getenv("LANGFUSE_ENABLED", "false").lower() == "true"
        self.public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
        self.secret_key = os.getenv("LANGFUSE_SECRET_KEY")
        self.host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
        
        self.client: Optional[Langfuse] = None
        
        if self.enabled:
            self._initialize_client()
    
    def _initialize_client(self):
        """Initialize LangFuse client if credentials are provided"""
        try:
            if not self.public_key or not self.secret_key:
                logger.warning("LangFuse enabled but missing credentials. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY")
                self.enabled = False
                return
            
            self.client = Langfuse(
                public_key=self.public_key,
                secret_key=self.secret_key,
                host=self.host
            )
            
            logger.info("LangFuse client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize LangFuse client: {e}")
            self.enabled = False
            self.client = None
    
    def is_enabled(self) -> bool:
        """Check if LangFuse is enabled and properly configured"""
        return self.enabled and self.client is not None
    
    def get_client(self) -> Optional[Langfuse]:
        """Get the LangFuse client instance"""
        return self.client if self.is_enabled() else None
    
    def create_trace(self, name: str, **kwargs):
        """Create a new trace for tracking operations"""
        if not self.is_enabled():
            return None
        
        try:
            # Use the correct LangFuse API - return the context manager
            return self.client.start_as_current_observation(
                name=name,
                **kwargs
            )
        except Exception as e:
            logger.error(f"Failed to create LangFuse trace: {e}")
            return None
    
    def flush(self):
        """Flush pending traces to LangFuse"""
        if self.is_enabled():
            try:
                self.client.flush()
            except Exception as e:
                logger.error(f"Failed to flush LangFuse traces: {e}")

# Global LangFuse configuration instance
langfuse_config = LangfuseConfig()
