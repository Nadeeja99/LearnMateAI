"""
API endpoint tests for LearnMate AI Backend
Tests all API endpoints with various scenarios
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
import tempfile
import os

from app.main import app
from app.models import QuestionRequest, SummaryRequest, QuizRequest

client = TestClient(app)

class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test health check endpoint returns correct response"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "LearnMate AI API is running" in data["message"]

class TestUploadEndpoint:
    """Test document upload endpoint"""
    
    @pytest.fixture
    def sample_pdf_content(self):
        """Create sample PDF content for testing"""
        # This would be actual PDF bytes in a real test
        return b"Sample PDF content"
    
    @patch('app.main.document_processor.process_document')
    @patch('app.main.vector_store.add_document')
    @patch('app.main.vector_store.save_index')
    async def test_upload_pdf_success(self, mock_save, mock_add, mock_process, sample_pdf_content):
        """Test successful PDF upload"""
        # Mock the document processor response
        mock_process.return_value = {
            "status": "success",
            "file_name": "test.pdf",
            "chunks": 10,
            "pages": 5,
            "file_size": "1.2MB"
        }
        
        # Create a mock file
        files = {"file": ("test.pdf", sample_pdf_content, "application/pdf")}
        
        response = client.post("/upload", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Document uploaded and processed successfully"
        assert "details" in data
    
    def test_upload_invalid_file_type(self):
        """Test upload with invalid file type"""
        files = {"file": ("test.txt", b"Not a PDF", "text/plain")}
        response = client.post("/upload", files=files)
        assert response.status_code == 400
        assert "Only PDF files are supported" in response.json()["detail"]
    
    def test_upload_no_file(self):
        """Test upload without file"""
        response = client.post("/upload")
        assert response.status_code == 422  # Validation error

class TestAskEndpoint:
    """Test question asking endpoint"""
    
    @patch('app.main.vector_store.has_documents')
    @patch('app.main.rag_chain.ask_question')
    async def test_ask_question_success(self, mock_ask, mock_has_docs):
        """Test successful question asking"""
        mock_has_docs.return_value = True
        mock_ask.return_value = ("Test answer", ["Source 1", "Source 2"])
        
        request_data = {
            "question": "What is machine learning?",
            "conversation_id": "test-session"
        }
        
        response = client.post("/ask", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "sources" in data
        assert "conversation_id" in data
    
    @patch('app.main.vector_store.has_documents')
    def test_ask_question_no_documents(self, mock_has_docs):
        """Test asking question without uploaded documents"""
        mock_has_docs.return_value = False
        
        request_data = {"question": "What is machine learning?"}
        response = client.post("/ask", json=request_data)
        assert response.status_code == 400
        assert "No documents uploaded yet" in response.json()["detail"]

class TestSummarizeEndpoint:
    """Test document summarization endpoint"""
    
    @patch('app.main.vector_store.has_documents')
    @patch('app.main.rag_chain.generate_summary')
    async def test_generate_summary_success(self, mock_summary, mock_has_docs):
        """Test successful summary generation"""
        mock_has_docs.return_value = True
        mock_summary.return_value = "This is a test summary"
        
        request_data = {"document_name": "test.pdf"}
        response = client.post("/summarize", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "document_name" in data
        assert "generated_at" in data
    
    @patch('app.main.vector_store.has_documents')
    def test_generate_summary_no_documents(self, mock_has_docs):
        """Test summary generation without documents"""
        mock_has_docs.return_value = False
        
        request_data = {}
        response = client.post("/summarize", json=request_data)
        assert response.status_code == 400
        assert "No documents uploaded yet" in response.json()["detail"]

class TestQuizEndpoint:
    """Test quiz generation endpoint"""
    
    @patch('app.main.vector_store.has_documents')
    @patch('app.main.rag_chain.generate_quiz')
    async def test_generate_quiz_success(self, mock_quiz, mock_has_docs):
        """Test successful quiz generation"""
        mock_has_docs.return_value = True
        mock_quiz.return_value = [
            {
                "question": "What is AI?",
                "options": {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
                "correct_answer": "A",
                "explanation": "AI is artificial intelligence"
            }
        ]
        
        request_data = {
            "num_questions": 5,
            "difficulty": "medium",
            "document_name": "test.pdf"
        }
        
        response = client.post("/generate-quiz", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert "quiz" in data
        assert "total_questions" in data
        assert "difficulty" in data
    
    def test_generate_quiz_invalid_parameters(self):
        """Test quiz generation with invalid parameters"""
        request_data = {
            "num_questions": 25,  # Too many questions
            "difficulty": "invalid"  # Invalid difficulty
        }
        response = client.post("/generate-quiz", json=request_data)
        assert response.status_code == 422  # Validation error

class TestDocumentsEndpoint:
    """Test document management endpoints"""
    
    @patch('app.main.vector_store.list_documents')
    async def test_list_documents(self, mock_list):
        """Test listing documents"""
        mock_list.return_value = [
            {
                "filename": "test.pdf",
                "upload_date": "2025-10-18T10:00:00Z",
                "file_size": "1.2MB",
                "pages": 5,
                "chunks": 10
            }
        ]
        
        response = client.get("/documents")
        assert response.status_code == 200
        data = response.json()
        assert "documents" in data
        assert "total" in data
        assert len(data["documents"]) == 1
    
    @patch('app.main.vector_store.get_document_info')
    async def test_get_document_info(self, mock_info):
        """Test getting document info"""
        mock_info.return_value = {
            "filename": "test.pdf",
            "upload_date": "2025-10-18T10:00:00Z",
            "file_size": "1.2MB",
            "pages": 5,
            "chunks": 10,
            "metadata": {}
        }
        
        response = client.get("/documents/test.pdf")
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test.pdf"
    
    @patch('app.main.vector_store.get_document_info')
    async def test_get_document_info_not_found(self, mock_info):
        """Test getting info for non-existent document"""
        mock_info.return_value = None
        
        response = client.get("/documents/nonexistent.pdf")
        assert response.status_code == 404
        assert "Document not found" in response.json()["detail"]
    
    @patch('app.main.vector_store.remove_document')
    @patch('app.main.vector_store.save_index')
    async def test_delete_document(self, mock_save, mock_remove):
        """Test document deletion"""
        mock_remove.return_value = True
        
        response = client.delete("/documents/test.pdf")
        assert response.status_code == 200
        data = response.json()
        assert "Document deleted successfully" in data["message"]
        assert data["filename"] == "test.pdf"
    
    @patch('app.main.vector_store.remove_document')
    async def test_delete_document_not_found(self, mock_remove):
        """Test deleting non-existent document"""
        mock_remove.return_value = False
        
        response = client.delete("/documents/nonexistent.pdf")
        assert response.status_code == 404
        assert "Document not found" in response.json()["detail"]

class TestClearMemoryEndpoint:
    """Test memory clearing endpoint"""
    
    @patch('app.main.rag_chain.clear_memory')
    async def test_clear_memory(self, mock_clear):
        """Test clearing conversation memory"""
        response = client.post("/clear-memory")
        assert response.status_code == 200
        data = response.json()
        assert "Chat memory cleared successfully" in data["message"]
    
    @patch('app.main.rag_chain.clear_memory')
    async def test_clear_memory_with_conversation_id(self, mock_clear):
        """Test clearing specific conversation memory"""
        response = client.post("/clear-memory?conversation_id=test-session")
        assert response.status_code == 200
        data = response.json()
        assert "Chat memory cleared successfully" in data["message"]

# Integration tests
class TestIntegration:
    """Integration tests for the complete workflow"""
    
    @pytest.mark.asyncio
    async def test_complete_workflow(self):
        """Test complete workflow: upload -> ask -> summarize -> quiz"""
        # This would be a comprehensive integration test
        # that tests the entire workflow end-to-end
        pass
