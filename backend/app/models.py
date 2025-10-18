"""
Pydantic models for LearnMate AI Backend API
Defines request/response schemas for all endpoints
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DifficultyLevel(str, Enum):
    """Quiz difficulty levels"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class QuestionRequest(BaseModel):
    """Request model for asking questions"""
    question: str = Field(..., min_length=1, max_length=1000, description="The question to ask")
    conversation_id: Optional[str] = Field(None, description="Optional conversation session ID")

class QuestionResponse(BaseModel):
    """Response model for question answers"""
    answer: str = Field(..., description="The AI-generated answer")
    sources: List[str] = Field(..., description="Source chunks that support the answer")
    conversation_id: str = Field(..., description="Conversation session ID")

class SummaryRequest(BaseModel):
    """Request model for generating summaries"""
    document_name: Optional[str] = Field(None, description="Specific document to summarize (optional)")

class SummaryResponse(BaseModel):
    """Response model for document summaries"""
    summary: str = Field(..., description="Generated summary of the document(s)")
    document_name: str = Field(..., description="Name of the summarized document(s)")
    generated_at: str = Field(..., description="Timestamp when summary was generated")

class QuizRequest(BaseModel):
    """Request model for generating quizzes"""
    num_questions: int = Field(5, ge=1, le=20, description="Number of questions to generate")
    difficulty: DifficultyLevel = Field(DifficultyLevel.MEDIUM, description="Difficulty level of the quiz")
    document_name: Optional[str] = Field(None, description="Specific document for quiz (optional)")

class QuizQuestion(BaseModel):
    """Model for individual quiz questions"""
    question: str = Field(..., description="The quiz question")
    options: Dict[str, str] = Field(..., description="Answer options (A, B, C, D)")
    correct_answer: str = Field(..., description="The correct answer option")
    explanation: str = Field(..., description="Explanation of the correct answer")

class QuizResponse(BaseModel):
    """Response model for generated quizzes"""
    quiz: List[QuizQuestion] = Field(..., description="List of quiz questions")
    total_questions: int = Field(..., description="Total number of questions")
    difficulty: DifficultyLevel = Field(..., description="Difficulty level of the quiz")

class DocumentDetails(BaseModel):
    """Model for document processing details"""
    status: str = Field(..., description="Processing status")
    file_name: str = Field(..., description="Original filename")
    chunks: int = Field(..., description="Number of text chunks created")
    pages: int = Field(..., description="Number of pages in the document")
    file_size: str = Field(..., description="Human-readable file size")

class UploadResponse(BaseModel):
    """Response model for document uploads"""
    message: str = Field(..., description="Upload status message")
    details: DocumentDetails = Field(..., description="Document processing details")

class DocumentInfo(BaseModel):
    """Model for document information"""
    filename: str = Field(..., description="Document filename")
    upload_date: str = Field(..., description="Upload timestamp")
    file_size: str = Field(..., description="Human-readable file size")
    pages: int = Field(..., description="Number of pages")
    chunks: int = Field(..., description="Number of text chunks")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

class ErrorResponse(BaseModel):
    """Model for error responses"""
    detail: str = Field(..., description="Error message")

class HealthResponse(BaseModel):
    """Model for health check responses"""
    message: str = Field(..., description="Health status message")
    version: str = Field(..., description="API version")

class ClearMemoryRequest(BaseModel):
    """Request model for clearing chat memory"""
    conversation_id: Optional[str] = Field(None, description="Specific conversation to clear (optional)")

class ClearMemoryResponse(BaseModel):
    """Response model for clearing chat memory"""
    message: str = Field(..., description="Clear memory status message")

# Internal models for document processing
class DocumentChunk(BaseModel):
    """Model for document text chunks"""
    content: str = Field(..., description="Chunk text content")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk metadata")
    page_number: Optional[int] = Field(None, description="Source page number")
    chunk_index: int = Field(..., description="Chunk index in document")

class ProcessedDocument(BaseModel):
    """Model for processed document data"""
    filename: str = Field(..., description="Document filename")
    content: str = Field(..., description="Full document text")
    chunks: List[DocumentChunk] = Field(..., description="Document text chunks")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    upload_date: str = Field(..., description="Upload timestamp")
    file_size: int = Field(..., description="File size in bytes")
    pages: int = Field(..., description="Number of pages")

class VectorSearchResult(BaseModel):
    """Model for vector search results"""
    content: str = Field(..., description="Chunk content")
    score: float = Field(..., description="Similarity score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk metadata")
    source_document: str = Field(..., description="Source document filename")
