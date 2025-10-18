"""
LearnMate AI Backend - Simplified FastAPI Application
Basic PDF upload and question answering functionality
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
import os
import io
from typing import Optional
import PyPDF2
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="LearnMate AI",
    version="1.0.0",
    description="Personal Learning Assistant API for document processing and AI-powered interactions"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for document storage
uploaded_documents = {}
openai_client = None

def get_openai_client():
    """Initialize OpenAI client"""
    global openai_client
    if openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        openai_client = openai.OpenAI(api_key=api_key)
    return openai_client

def extract_pdf_text(file_content: bytes) -> str:
    """Extract text from PDF content"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        logger.error(f"Error extracting PDF text: {e}")
        raise HTTPException(status_code=400, detail="Failed to extract text from PDF")

# Health Check
@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {
        "message": "LearnMate AI API is running",
        "version": "1.0.0"
    }

# Upload Document
@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a PDF document"""
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Read file content
        content = await file.read()
        
        # Check file size (10MB limit)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        # Extract text from PDF
        text = extract_pdf_text(content)
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text found in PDF")
        
        # Store document
        uploaded_documents[file.filename] = {
            "filename": file.filename,
            "content": text,
            "size": len(content)
        }
        
        logger.info(f"Document {file.filename} uploaded successfully")
        
        return {
            "message": "Document uploaded and processed successfully",
            "details": {
                "status": "success",
                "file_name": file.filename,
                "file_size": f"{len(content) / (1024 * 1024):.1f}MB",
                "text_length": len(text)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Processing error")

# Ask Question
@app.post("/ask")
async def ask_question(question_data: dict):
    """Ask a question about uploaded documents"""
    try:
        question = question_data.get("question", "").strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        if not uploaded_documents:
            raise HTTPException(
                status_code=400, 
                detail="No documents uploaded yet. Please upload a document first."
            )
        
        # Combine all document content
        all_content = "\n\n".join([doc["content"] for doc in uploaded_documents.values()])
        
        # Get OpenAI client
        client = get_openai_client()
        
        # Create prompt
        prompt = f"""Based on the following document content, please answer the question: {question}

Document Content:
{all_content}

Please provide a clear and accurate answer based on the document content. If the answer is not found in the documents, please say so."""

        # Get answer from OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that answers questions based on provided document content."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        answer = response.choices[0].message.content
        
        return {
            "answer": answer,
            "sources": [f"Document: {filename}" for filename in uploaded_documents.keys()],
            "conversation_id": "simple-session"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Question error: {e}")
        raise HTTPException(status_code=500, detail="Error processing question")

# List Documents
@app.get("/documents")
async def list_documents():
    """List all uploaded documents"""
    try:
        documents = []
        for filename, doc in uploaded_documents.items():
            documents.append({
                "filename": filename,
                "file_size": f"{doc['size'] / (1024 * 1024):.1f}MB",
                "text_length": len(doc['content'])
            })
        
        return {
            "documents": documents,
            "total": len(documents)
        }
    except Exception as e:
        logger.error(f"List documents error: {e}")
        raise HTTPException(status_code=500, detail="Error listing documents")

# Delete Document
@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Delete a specific document"""
    try:
        if filename not in uploaded_documents:
            raise HTTPException(status_code=404, detail="Document not found")
        
        del uploaded_documents[filename]
        
        return {
            "message": "Document deleted successfully",
            "filename": filename
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete document error: {e}")
        raise HTTPException(status_code=500, detail="Error deleting document")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )