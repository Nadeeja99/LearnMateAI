"""
Runtime service singletons, created once at startup by init_services().

Routers read these attributes at call time (services.rag_chain, ...), never at import
time, so tests and tooling can swap any of them.
"""

import logging
from typing import Optional

from .config import Settings
from .conversation_memory import ConversationMemory, conversation_memory
from .document_processor import DocumentProcessor
from .learning_analytics import LearningAnalytics, learning_analytics
from .rag_chain import RAGChain
from .sessions import SessionStoreRegistry
from .vector_store import VectorStore
from .voice_agent import VoiceAgent
from .voice_processing import VoiceProcessingService

logger = logging.getLogger(__name__)


class Services:
    document_processor: Optional[DocumentProcessor] = None
    session_stores: Optional[SessionStoreRegistry] = None
    rag_chain: Optional[RAGChain] = None  # unbound; use chain(session_id)
    voice_processing: Optional[VoiceProcessingService] = None
    voice_agent: Optional[VoiceAgent] = None
    conversations: Optional[ConversationMemory] = conversation_memory
    analytics: Optional[LearningAnalytics] = learning_analytics

    def store(self, session_id: str) -> VectorStore:
        """The caller's own vector store"""
        return self.session_stores.get(session_id)

    def chain(self, session_id: str) -> RAGChain:
        """The RAG chain bound to one session's documents"""
        return self.rag_chain.with_store(self.store(session_id))


services = Services()


def init_services(settings: Settings) -> None:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    key = settings.openai_api_key
    services.document_processor = DocumentProcessor()
    services.session_stores = SessionStoreRegistry(key, root_dir=settings.sessions_dir)
    services.rag_chain = RAGChain(key, vector_store=None)
    services.voice_processing = VoiceProcessingService(key)
    services.voice_agent = VoiceAgent(services.rag_chain, services.voice_processing, chain_for_session=services.chain)

    # Documents persist across restarts; only sessions idle past the TTL are removed
    services.session_stores.cleanup_expired(settings.session_ttl_days)
    logger.info("Services initialized")
