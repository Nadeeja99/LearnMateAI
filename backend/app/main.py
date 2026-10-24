import os
import logging
import io
from datetime import datetime
from fastapi import Depends, FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
import uvicorn
import uuid
import json

# Import our RAG modules
from .document_processor import DocumentProcessor
from .sessions import SessionStoreRegistry, is_valid_session_id, require_session_id
from .rag_chain import RAGChain
from .langfuse_config import langfuse_config
from .conversation_memory import conversation_memory
from .learning_analytics import learning_analytics
from .voice_agent import VoiceAgent, voice_agent
from .voice_processing import VoiceProcessingService, voice_processing_service
from .schemas import QuizGenerationError

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="LearnMate AI - RAG System",
    version="1.0.0",
    description="Personal Learning Assistant API with RAG for document processing and AI-powered interactions"
)

# Configure CORS
allowed_origins = [
    "http://localhost:3000", 
    "http://localhost:5173", 
    "http://localhost:8080", 
    "http://localhost:8501", 
    "http://localhost:8081"
]

# Add production origins if in production
if os.getenv("ENVIRONMENT") == "production":
    allowed_origins.extend([
        "https://learnmate-frontend.onrender.com",
        "https://learnmate-ai.onrender.com",
        # Add your specific Render URLs here
    ])

# Always add the specific Render URLs regardless of environment
allowed_origins.extend([
    "https://learnmate-frontend.onrender.com",
    "https://learnmate-backend-koe5.onrender.com",
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for RAG system
document_processor = None
session_stores = None  # Per-session vector stores (see sessions.py)
rag_chain = None

def _chain(session_id: str) -> RAGChain:
    """The RAG chain bound to one session's documents"""
    return rag_chain.with_store(session_stores.get(session_id))

def initialize_rag_system():
    """Initialize the RAG system components"""
    global document_processor, session_stores, rag_chain, voice_agent, voice_processing_service
    
    try:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise Exception("OPENAI_API_KEY not found in environment variables")
        
        # Initialize components
        document_processor = DocumentProcessor()
        session_stores = SessionStoreRegistry(openai_api_key)
        # Unbound chain; each request binds it to the caller's store via _chain(session_id)
        rag_chain = RAGChain(openai_api_key, vector_store=None)
        
        # Initialize voice processing service
        voice_processing_service = VoiceProcessingService(openai_api_key)
        
        # Initialize voice agent
        voice_agent = VoiceAgent(rag_chain, voice_processing_service, chain_for_session=_chain)
        
        # Documents persist across restarts; only sessions idle past the TTL are removed
        session_stores.cleanup_expired(float(os.getenv("SESSION_TTL_DAYS", "30")))
        
        # Log LangFuse status
        if langfuse_config.is_enabled():
            logger.info("LangFuse observability enabled")
        else:
            logger.info("LangFuse observability disabled")
        
        logger.info("RAG system initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize RAG system: {e}")
        raise Exception(f"RAG system initialization failed: {str(e)}")

# Initialize RAG system on startup
initialize_rag_system()

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

def _store(session_id: str):
    return session_stores.get(session_id)

def _session_documents(store, document_name: str = None):
    """The session's documents, narrowed to document_name when it is one of them"""
    session_docs = list(store.document_summaries().keys()) or None
    if document_name and session_docs and document_name in session_docs:
        return [document_name]
    return session_docs

def _require_documents(store):
    if not store.has_documents():
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded yet. Please upload a document first."
        )

def _require_own_conversation(conversation_id: str, session_id: str):
    """404 for conversations that don't exist or belong to another session"""
    if conversation_id and conversation_id != "default" and not conversation_memory.owns(conversation_id, session_id):
        raise HTTPException(status_code=404, detail="Conversation not found")

def _require_self(user_id: str, session_id: str):
    if user_id != session_id:
        raise HTTPException(status_code=403, detail="You can only access your own data")

def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"

def _event_stream(events, label: str) -> StreamingResponse:
    """Serialize RAG events as Server-Sent Events.

    If the client disconnects, Starlette cancels this generator, which closes the
    upstream LLM stream so generation stops server-side too.
    """
    async def generate():
        try:
            async for event in events:
                yield _sse(event["type"], event)
        except Exception as e:
            logger.error(f"{label} stream error: {e}")
            message = str(e) if isinstance(e, ValueError) else f"{label} failed. Please try again."
            yield _sse("error", {"type": "error", "message": message})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# Health Check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "rag_system": "initialized" if rag_chain else "not_initialized"
    }

# Upload Document
@app.post("/upload")
async def upload_document(file: UploadFile = File(...), session_id: str = Depends(require_session_id)):
    """Upload and process a document into the caller's session"""
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        logger.info(f"Processing document: {file.filename}")
        
        # Read file content
        content = await file.read()
        
        # Process document with RAG system
        documents = document_processor.process_document(file.filename, content)
        uploaded_at = datetime.now().isoformat()
        for doc in documents:
            doc.metadata["uploaded_at"] = uploaded_at
        
        # Re-uploading a file replaces it instead of duplicating its chunks
        store = _store(session_id)
        if file.filename in store.document_summaries():
            store.delete_document(file.filename)
        store.add_documents(documents)
        
        logger.info(f"Document {file.filename} processed and added to vector store successfully")
        
        # Track analytics for upload
        if learning_analytics:
            learning_analytics.track_session(
                user_id=session_id,
                session_type="upload",
                document_name=file.filename,
                duration_seconds=0,
                metadata={
                    "file_size": len(content),
                    "chunks_count": len(documents),
                    "file_type": "pdf"
                }
            )
        
        return {
            "message": "Document uploaded and processed successfully",
            "details": {
                "status": "success",
                "file_name": file.filename,
                "chunks_created": len(documents),
                "total_documents": len(store.get_all_documents())
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

# Ask Question
@app.post("/ask")
async def ask_question(question_data: dict, session_id: str = Depends(require_session_id)):
    """Ask a question using RAG system"""
    try:
        question = question_data.get("question", "").strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        store = _store(session_id)
        _require_documents(store)
        conversation_id = question_data.get("conversation_id", "default")
        _require_own_conversation(conversation_id, session_id)
        
        logger.info(f"Processing question: {question[:100]}...")
        
        # Use RAG chain to answer question with conversation memory
        result = await _chain(session_id).answer_question(
            question=question, 
            document_names=_session_documents(store),
            conversation_id=conversation_id,
            user_id=session_id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Question error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

# Ask Question (streaming)
@app.post("/ask/stream")
async def ask_question_stream(question_data: dict, session_id: str = Depends(require_session_id)):
    """Stream an answer as SSE events: meta, token*, done (or error)"""
    question = (question_data.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    store = _store(session_id)
    _require_documents(store)
    conversation_id = question_data.get("conversation_id", "default")
    _require_own_conversation(conversation_id, session_id)

    logger.info(f"Streaming answer for: {question[:100]}...")
    events = _chain(session_id).stream_answer(
        question=question,
        document_names=_session_documents(store),
        conversation_id=conversation_id,
        user_id=session_id,
    )
    return _event_stream(events, "Answer generation")

# List Documents
@app.get("/documents")
async def list_documents(session_id: str = Depends(require_session_id)):
    """List the caller's processed documents"""
    try:
        store = _store(session_id)
        summaries = store.document_summaries().values()
        doc_list = [
            {
                "filename": summary["filename"],
                "file_size": f"{(summary['file_size'] or 0) / (1024 * 1024):.1f}MB",
                "chunks_count": summary["chunks_count"],
                "uploaded_at": summary["uploaded_at"],
            }
            for summary in summaries
        ]
        
        return {
            "documents": doc_list,
            "total": len(doc_list),
            "total_chunks": len(store.get_all_documents())
        }
    except Exception as e:
        logger.error(f"List documents error: {e}")
        raise HTTPException(status_code=500, detail="Error listing documents")

# Generate Summary
@app.post("/summarize")
async def generate_summary(summary_data: dict, session_id: str = Depends(require_session_id)):
    """Generate a summary using RAG system"""
    try:
        store = _store(session_id)
        _require_documents(store)
        document_name = summary_data.get("document_name")
        summary_docs = _session_documents(store, document_name)
        
        logger.info(f"Generating summary for: {summary_docs or 'all documents'}")
        
        # Use RAG chain to generate summary with analytics
        summary = await _chain(session_id).generate_summary(summary_docs, user_id=session_id)
        
        return {
            "summary": summary,
            "document_name": document_name or "all_documents",
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summary error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")

# Generate Summary (streaming)
@app.post("/summarize/stream")
async def generate_summary_stream(summary_data: dict, session_id: str = Depends(require_session_id)):
    """Stream a Markdown summary as SSE events: meta, token*, done (or error)"""
    store = _store(session_id)
    _require_documents(store)
    summary_docs = _session_documents(store, summary_data.get("document_name"))
    logger.info(f"Streaming summary for: {summary_docs or 'all documents'}")
    events = _chain(session_id).stream_summary(summary_docs, user_id=session_id)
    return _event_stream(events, "Summary generation")

# Generate Quiz
@app.post("/generate-quiz")
async def generate_quiz(quiz_data: dict, session_id: str = Depends(require_session_id)):
    """Generate a quiz using RAG system"""
    try:
        store = _store(session_id)
        _require_documents(store)
        
        num_questions = quiz_data.get("num_questions", 5)
        difficulty = quiz_data.get("difficulty", "medium")
        document_name = quiz_data.get("document_name")
        
        if num_questions < 1 or num_questions > 20:
            raise HTTPException(
                status_code=400,
                detail="Number of questions must be between 1 and 20"
            )
        
        # Get current session document names
        quiz_docs = _session_documents(store, document_name)
        
        logger.info(f"Generating {num_questions} {difficulty} questions")
        logger.info(f"Using documents: {quiz_docs}")
        
        # Use RAG chain to generate quiz
        result = await _chain(session_id).generate_quiz(num_questions, difficulty, quiz_docs)
        questions = result["questions"]
        
        return {
            "quiz": questions,
            "total_questions": len(questions),
            "telemetry": result["telemetry"],
            "difficulty": difficulty,
            "document_name": document_name or "all_documents",
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except QuizGenerationError as e:
        logger.error(f"Quiz validation error: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"Quiz generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

# Delete Specific Document
@app.delete("/documents/{filename}")
async def delete_document(filename: str, session_id: str = Depends(require_session_id)):
    """Delete a specific document from the caller's session"""
    try:
        _store(session_id).delete_document(filename)
        logger.info(f"Document {filename} deleted from session store")
        
        return {
            "message": f"Document '{filename}' deleted successfully",
            "timestamp": datetime.now().isoformat(),
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Delete document error: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")

# Clear Vector Store
@app.delete("/clear-documents")
async def clear_documents(session_id: str = Depends(require_session_id)):
    """Clear all documents from the caller's session"""
    try:
        session_stores.delete(session_id)
        logger.info("Session documents cleared successfully")
        return {
            "message": "All documents cleared successfully",
            "timestamp": datetime.now().isoformat(),
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Clear documents error: {e}")
        raise HTTPException(status_code=500, detail="Error clearing documents")

# Get Current Session Documents
@app.get("/current-session-documents")
async def get_current_session_documents(session_id: str = Depends(require_session_id)):
    """Get documents in the caller's session (persisted across server restarts)"""
    try:
        details = _store(session_id).document_summaries()
        return {
            "documents": list(details.keys()),
            "total": len(details),
            "details": details
        }
    except Exception as e:
        logger.error(f"Current session documents error: {e}")
        raise HTTPException(status_code=500, detail="Error getting current session documents")

# Get Vector Store Info
@app.get("/vector-store-info")
async def get_vector_store_info(session_id: str = Depends(require_session_id)):
    """Get information about the caller's vector store"""
    try:
        store = _store(session_id)
        documents = store.get_all_documents()
        summaries = store.document_summaries()
        
        return {
            "has_documents": store.has_documents(),
            "total_documents": len(documents),
            "unique_sources": len(summaries),
            "total_chunks": len(documents),
            "current_session_documents": list(summaries.keys())
        }
    except Exception as e:
        logger.error(f"Vector store info error: {e}")
        raise HTTPException(status_code=500, detail="Error getting vector store info")

# ===== CONVERSATION MEMORY ENDPOINTS =====

@app.post("/conversations")
async def create_conversation(conversation_data: dict, session_id: str = Depends(require_session_id)):
    """Create a new conversation owned by the caller's session"""
    try:
        user_id = session_id
        title = conversation_data.get("title", None)
        document_context = conversation_data.get("document_context", [])
        
        conversation_id = conversation_memory.create_conversation(
            user_id=user_id,
            title=title,
            document_context=document_context
        )
        
        return {
            "conversation_id": conversation_id,
            "message": "Conversation created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating conversation: {str(e)}")

@app.get("/conversations/{conversation_id}/history")
async def get_conversation_history(conversation_id: str, limit: int = 10, session_id: str = Depends(require_session_id)):
    """Get conversation history"""
    _require_own_conversation(conversation_id, session_id)
    try:
        history = conversation_memory.get_conversation_history(conversation_id, limit)
        context = conversation_memory.get_conversation_context(conversation_id)
        
        return {
            "conversation_id": conversation_id,
            "history": history,
            "context": context
        }
    except Exception as e:
        logger.error(f"Error getting conversation history: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting conversation history: {str(e)}")

@app.get("/conversations/user/{user_id}")
async def get_user_conversations(user_id: str, limit: int = 20, session_id: str = Depends(require_session_id)):
    """Get all conversations for a user (only the caller's own)"""
    _require_self(user_id, session_id)
    try:
        conversations = conversation_memory.get_user_conversations(user_id, limit)
        return {
            "user_id": user_id,
            "conversations": conversations
        }
    except Exception as e:
        logger.error(f"Error getting user conversations: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting user conversations: {str(e)}")

@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, session_id: str = Depends(require_session_id)):
    """Delete a conversation"""
    _require_own_conversation(conversation_id, session_id)
    try:
        conversation_memory.delete_conversation(conversation_id)
        return {"message": f"Conversation {conversation_id} deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(e)}")

# ===== LEARNING ANALYTICS ENDPOINTS =====

@app.get("/analytics/user/{user_id}")
async def get_user_analytics(user_id: str, session_id: str = Depends(require_session_id)):
    """Get comprehensive analytics for a user (only the caller's own)"""
    _require_self(user_id, session_id)
    try:
        analytics = learning_analytics.get_user_analytics(user_id)
        return analytics
    except Exception as e:
        logger.error(f"Error getting user analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting user analytics: {str(e)}")

@app.get("/analytics/global")
async def get_global_analytics():
    """Get global analytics across all users"""
    try:
        analytics = learning_analytics.get_global_analytics()
        return analytics
    except Exception as e:
        logger.error(f"Error getting global analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting global analytics: {str(e)}")

@app.get("/analytics/performance-metrics")
async def get_performance_metrics(metric_name: str = None, days: int = 30):
    """Get performance metrics"""
    try:
        metrics = learning_analytics.get_performance_metrics(metric_name, days)
        return {
            "metrics": metrics,
            "metric_name": metric_name,
            "days": days
        }
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting performance metrics: {str(e)}")

@app.post("/analytics/track-quiz")
async def track_quiz_completion(quiz_data: dict, session_id: str = Depends(require_session_id)):
    """Track quiz completion analytics"""
    try:
        user_id = session_id
        quiz_score = quiz_data.get("quiz_score", 0)
        total_questions = quiz_data.get("total_questions", 1)
        score_percentage = quiz_data.get("score_percentage", 0)
        
        # Track quiz completion session
        learning_analytics.track_session(
            user_id=user_id,
            session_type="quiz",
            document_name=None,
            duration_seconds=0,
            metadata={
                "quiz_score": quiz_score,
                "total_questions": total_questions,
                "score_percentage": score_percentage,
                "completed_at": quiz_data.get("completed_at")
            }
        )
        
        # Add performance metric for quiz score
        learning_analytics.add_performance_metric(
            metric_name="quiz_score_percentage",
            value=score_percentage,
            context={
                "quiz_score": quiz_score,
                "total_questions": total_questions
            }
        )
        
        return {"message": "Quiz completion tracked successfully"}
    except Exception as e:
        logger.error(f"Error tracking quiz completion: {e}")
        raise HTTPException(status_code=500, detail=f"Error tracking quiz completion: {str(e)}")

# ===== VOICE AGENT ENDPOINTS =====

@app.websocket("/voice/ws/{client_id}")
async def websocket_voice_endpoint(websocket: WebSocket, client_id: str, session_id: str = ""):
    """WebSocket endpoint for real-time voice interaction.

    Browsers can't set headers on WebSockets, so the session id comes as ?session_id=.
    """
    if not is_valid_session_id(session_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        await voice_agent.connect(websocket, client_id, session_id)
        
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle the message
                await voice_agent.handle_websocket_message(client_id, message)
                
            except WebSocketDisconnect:
                logger.info(f"Client {client_id} disconnected from voice agent")
                break
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "An error occurred processing your request"
                }))
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        await voice_agent.disconnect(client_id)

@app.get("/voice/status")
async def get_voice_agent_status():
    """Get voice agent status and active connections"""
    try:
        return {
            "status": "active",
            "active_connections": voice_agent.get_active_connections_count(),
            "voice_enabled": True,
            "features": [
                "real_time_voice_chat",
                "pdf_analysis",
                "conversation_memory",
                "analytics_tracking"
            ]
        }
    except Exception as e:
        logger.error(f"Error getting voice agent status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting voice agent status: {str(e)}")

@app.get("/voice/connections")
async def get_voice_connections():
    """Get information about active voice connections"""
    try:
        connections = []
        for client_id in voice_agent.active_connections.keys():
            info = voice_agent.get_connection_info(client_id)
            if info:
                connections.append(info)
        
        return {
            "active_connections": connections,
            "total_connections": len(connections)
        }
    except Exception as e:
        logger.error(f"Error getting voice connections: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting voice connections: {str(e)}")

@app.get("/voice/test")
async def test_voice_processing():
    """Test voice processing capabilities"""
    try:
        if not voice_processing_service:
            raise HTTPException(status_code=500, detail="Voice processing service not initialized")
        
        test_result = await voice_processing_service.test_voice_processing()
        return test_result
        
    except Exception as e:
        logger.error(f"Error testing voice processing: {e}")
        raise HTTPException(status_code=500, detail=f"Error testing voice processing: {str(e)}")

@app.get("/voice/voices")
async def get_available_voices():
    """Get available TTS voices"""
    try:
        if not voice_processing_service:
            raise HTTPException(status_code=500, detail="Voice processing service not initialized")
        
        return {
            "available_voices": voice_processing_service.get_available_voices(),
            "current_voice": voice_processing_service.tts_voice
        }
        
    except Exception as e:
        logger.error(f"Error getting available voices: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting available voices: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )