import os
import logging
import io
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import uvicorn

# Import our RAG modules
from .document_processor import DocumentProcessor
from .vector_store import VectorStore
from .rag_chain import RAGChain
from .langfuse_config import langfuse_config

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "http://localhost:8501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for RAG system
document_processor = None
vector_store = None
rag_chain = None
current_session_documents = {}  # Track documents uploaded in current session

def initialize_rag_system():
    """Initialize the RAG system components"""
    global document_processor, vector_store, rag_chain
    
    try:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise Exception("OPENAI_API_KEY not found in environment variables")
        
        # Initialize components
        document_processor = DocumentProcessor()
        vector_store = VectorStore(openai_api_key)
        rag_chain = RAGChain(openai_api_key, vector_store)
        
        # Clear any existing vector store to start fresh
        vector_store.clear_store()
        
        # Log LangFuse status
        if langfuse_config.is_enabled():
            logger.info("LangFuse observability enabled")
        else:
            logger.info("LangFuse observability disabled")
        
        logger.info("RAG system initialized successfully with fresh vector store")
        
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
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a document using RAG system"""
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        logger.info(f"Processing document: {file.filename}")
        
        # Read file content
        content = await file.read()
        
        # Process document with RAG system
        documents = document_processor.process_document(file.filename, content)
        
        # Add to vector store
        vector_store.add_documents(documents)
        
        # Track in current session
        current_session_documents[file.filename] = {
            "filename": file.filename,
            "chunks_count": len(documents),
            "uploaded_at": datetime.now().isoformat()
        }
        
        logger.info(f"Document {file.filename} processed and added to vector store successfully")
        
        return {
            "message": "Document uploaded and processed successfully",
            "details": {
                "status": "success",
                "file_name": file.filename,
                "chunks_created": len(documents),
                "total_documents": len(vector_store.get_all_documents())
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

# Ask Question
@app.post("/ask")
async def ask_question(question_data: dict):
    """Ask a question using RAG system"""
    try:
        question = question_data.get("question", "").strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        if not vector_store.has_documents():
            raise HTTPException(
                status_code=400, 
                detail="No documents uploaded yet. Please upload a document first."
            )
        
        logger.info(f"Processing question: {question[:100]}...")
        
        # Get current session document names
        session_docs = list(current_session_documents.keys()) if current_session_documents else None
        logger.info(f"Using documents from current session: {session_docs}")
        
        # Use RAG chain to answer question
        result = await rag_chain.answer_question(question, document_names=session_docs)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Question error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

# List Documents
@app.get("/documents")
async def list_documents():
    """List all processed documents"""
    try:
        documents = vector_store.get_all_documents()
        
        doc_list = []
        for doc in documents:
            metadata = doc.metadata
            doc_list.append({
                "filename": metadata["source"],
                "file_size": f"{metadata['file_size'] / (1024 * 1024):.1f}MB",
                "text_length": metadata["text_length"]
            })
        
        return {
            "documents": doc_list,
            "total": len(doc_list),
            "total_chunks": len(documents)
        }
    except Exception as e:
        logger.error(f"List documents error: {e}")
        raise HTTPException(status_code=500, detail="Error listing documents")

# Generate Summary
@app.post("/summarize")
async def generate_summary(summary_data: dict):
    """Generate a summary using RAG system"""
    try:
        if not vector_store.has_documents():
            raise HTTPException(
                status_code=400,
                detail="No documents uploaded yet. Please upload a document first."
            )
        
        document_name = summary_data.get("document_name")
        
        # Get current session document names
        session_docs = list(current_session_documents.keys()) if current_session_documents else None
        
        # If specific document requested, use only that one
        if document_name and document_name in session_docs:
            summary_docs = [document_name]
        else:
            summary_docs = session_docs
        
        logger.info(f"Generating summary for: {summary_docs or 'all documents'}")
        
        # Use RAG chain to generate summary
        summary = await rag_chain.generate_summary(summary_docs)
        
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

# Generate Quiz
@app.post("/generate-quiz")
async def generate_quiz(quiz_data: dict):
    """Generate a quiz using RAG system"""
    try:
        if not vector_store.has_documents():
            raise HTTPException(
                status_code=400,
                detail="No documents uploaded yet. Please upload a document first."
            )
        
        num_questions = quiz_data.get("num_questions", 5)
        difficulty = quiz_data.get("difficulty", "medium")
        document_name = quiz_data.get("document_name")
        
        if num_questions < 1 or num_questions > 20:
            raise HTTPException(
                status_code=400,
                detail="Number of questions must be between 1 and 20"
            )
        
        # Get current session document names
        session_docs = list(current_session_documents.keys()) if current_session_documents else None
        
        # If specific document requested, use only that one
        if document_name and document_name in session_docs:
            quiz_docs = [document_name]
        else:
            quiz_docs = session_docs
        
        logger.info(f"Generating {num_questions} {difficulty} questions")
        logger.info(f"Using documents: {quiz_docs}")
        
        # Use RAG chain to generate quiz
        questions = await rag_chain.generate_quiz(num_questions, difficulty, quiz_docs)
        
        return {
            "quiz": questions,
            "total_questions": len(questions),
            "difficulty": difficulty,
            "document_name": document_name or "all_documents",
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quiz generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

# Delete Specific Document
@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Delete a specific document from the vector store and current session"""
    try:
        global current_session_documents
        
        # Remove from current session documents
        if filename in current_session_documents:
            del current_session_documents[filename]
            logger.info(f"Document {filename} removed from current session")
        
        # Remove from vector store
        vector_store.delete_document(filename)
        logger.info(f"Document {filename} deleted from vector store")
        
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
async def clear_documents():
    """Clear all documents from the vector store and current session"""
    try:
        global current_session_documents
        vector_store.clear_store()
        current_session_documents = {}  # Clear session tracking
        logger.info("Vector store and session documents cleared successfully")
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
async def get_current_session_documents():
    """Get documents uploaded in current session"""
    try:
        return {
            "documents": list(current_session_documents.keys()),
            "total": len(current_session_documents),
            "details": current_session_documents
        }
    except Exception as e:
        logger.error(f"Current session documents error: {e}")
        raise HTTPException(status_code=500, detail="Error getting current session documents")

# Get Vector Store Info
@app.get("/vector-store-info")
async def get_vector_store_info():
    """Get information about the vector store"""
    try:
        documents = vector_store.get_all_documents()
        
        return {
            "has_documents": vector_store.has_documents(),
            "total_documents": len(documents),
            "unique_sources": len(set(doc.metadata["source"] for doc in documents)),
            "total_chunks": len(documents),
            "current_session_documents": list(current_session_documents.keys())
        }
    except Exception as e:
        logger.error(f"Vector store info error: {e}")
        raise HTTPException(status_code=500, detail="Error getting vector store info")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )