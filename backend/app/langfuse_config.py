"""
LangFuse configuration and client setup for LearnMate AI
Provides observability and tracing for RAG operations
"""

import logging
from typing import Optional
from langfuse import Langfuse

from .config import settings

logger = logging.getLogger(__name__)

class LangfuseConfig:
    """LangFuse configuration and client management"""
    
    def __init__(self):
        self.enabled = settings.langfuse_enabled
        self.public_key = settings.langfuse_public_key
        self.secret_key = settings.langfuse_secret_key
        self.host = settings.langfuse_host
        
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
        """Context manager for an LLM *generation* (model + token usage => Langfuse computes cost)"""
        if not self.is_enabled():
            return None
        
        try:
            return self.client.start_as_current_generation(name=name, **kwargs)
        except Exception as e:
            logger.error(f"Failed to create LangFuse trace: {e}")
            return None
    
    def start_generation(self, name: str, **kwargs):
        """Start a detached generation that the caller must end().

        Unlike create_trace this does not bind it to the current context, so it is safe to
        hold open across yields in an async generator (streaming responses).
        """
        if not self.is_enabled():
            return None

        try:
            return self.client.start_generation(name=name, **kwargs)
        except Exception as e:
            logger.error(f"Failed to start LangFuse generation: {e}")
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
