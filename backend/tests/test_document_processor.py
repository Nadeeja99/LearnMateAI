"""
Tests for document processing functionality
Tests PDF text extraction, chunking, and metadata processing
"""

import pytest
import tempfile
import os
from unittest.mock import Mock, patch, mock_open
from datetime import datetime

from app.document_processor import DocumentProcessor
from app.models import DocumentChunk

class TestDocumentProcessor:
    """Test document processor functionality"""
    
    @pytest.fixture
    def processor(self):
        """Create document processor instance"""
        return DocumentProcessor()
    
    @pytest.fixture
    def sample_pdf_content(self):
        """Sample PDF content for testing"""
        return b"Sample PDF content for testing"
    
    @pytest.fixture
    def mock_file(self, sample_pdf_content):
        """Mock uploaded file"""
        file_mock = Mock()
        file_mock.filename = "test.pdf"
        file_mock.read = Mock(return_value=sample_pdf_content)
        return file_mock
    
    def test_validate_pdf_file_valid(self, processor):
        """Test PDF file validation with valid file"""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(b'%PDF-1.4\nSample PDF content')
            tmp_path = tmp.name
        
        try:
            result = processor.validate_pdf_file(tmp_path)
            assert result is True
        finally:
            os.unlink(tmp_path)
    
    def test_validate_pdf_file_invalid(self, processor):
        """Test PDF file validation with invalid file"""
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp:
            tmp.write(b'Not a PDF file')
            tmp_path = tmp.name
        
        try:
            result = processor.validate_pdf_file(tmp_path)
            assert result is False
        finally:
            os.unlink(tmp_path)
    
    def test_get_file_info(self, processor):
        """Test getting file information"""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(b'Test content')
            tmp_path = tmp.name
        
        try:
            info = processor.get_file_info(tmp_path)
            assert 'size' in info
            assert 'created' in info
            assert 'modified' in info
            assert info['size'] > 0
        finally:
            os.unlink(tmp_path)
    
    @patch('app.document_processor.PyPDF2.PdfReader')
    async def test_extract_pdf_content_success(self, mock_pdf_reader, processor):
        """Test successful PDF content extraction"""
        # Mock PDF reader
        mock_page = Mock()
        mock_page.extract_text.return_value = "Sample page content"
        
        mock_reader = Mock()
        mock_reader.pages = [mock_page, mock_page]  # 2 pages
        mock_reader.metadata = {
            '/Title': 'Test Document',
            '/Author': 'Test Author'
        }
        mock_pdf_reader.return_value = mock_reader
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(b'%PDF-1.4\nSample PDF content')
            tmp_path = tmp.name
        
        try:
            text, pages, metadata = await processor._extract_pdf_content(tmp_path)
            
            assert isinstance(text, str)
            assert "Sample page content" in text
            assert pages == 2
            assert 'title' in metadata
            assert 'author' in metadata
            assert metadata['title'] == 'Test Document'
            assert metadata['author'] == 'Test Author'
        finally:
            os.unlink(tmp_path)
    
    @patch('app.document_processor.PyPDF2.PdfReader')
    async def test_extract_pdf_content_error(self, mock_pdf_reader, processor):
        """Test PDF content extraction with error"""
        mock_pdf_reader.side_effect = Exception("PDF reading error")
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(b'%PDF-1.4\nSample PDF content')
            tmp_path = tmp.name
        
        try:
            with pytest.raises(Exception) as exc_info:
                await processor._extract_pdf_content(tmp_path)
            assert "Failed to extract PDF content" in str(exc_info.value)
        finally:
            os.unlink(tmp_path)
    
    async def test_create_chunks(self, processor):
        """Test text chunking functionality"""
        sample_text = "This is a sample text. " * 100  # Long text to ensure chunking
        filename = "test.pdf"
        metadata = {"title": "Test Document"}
        
        chunks = await processor._create_chunks(sample_text, filename, metadata)
        
        assert isinstance(chunks, list)
        assert len(chunks) > 0
        
        for chunk in chunks:
            assert isinstance(chunk, DocumentChunk)
            assert chunk.content
            assert chunk.metadata
            assert chunk.metadata['source'] == filename
            assert chunk.metadata['title'] == "Test Document"
    
    @patch('app.document_processor.os.remove')
    @patch('app.document_processor.DocumentProcessor._extract_pdf_content')
    @patch('app.document_processor.DocumentProcessor._create_chunks')
    async def test_process_document_success(self, mock_chunks, mock_extract, mock_remove, processor, mock_file):
        """Test successful document processing"""
        # Mock the extraction
        mock_extract.return_value = ("Sample text", 5, {"title": "Test"})
        
        # Mock the chunking
        mock_chunks.return_value = [
            DocumentChunk(
                content="Chunk 1",
                metadata={"source": "test.pdf"},
                chunk_index=0
            ),
            DocumentChunk(
                content="Chunk 2", 
                metadata={"source": "test.pdf"},
                chunk_index=1
            )
        ]
        
        result = await processor.process_document(mock_file)
        
        assert result.status == "success"
        assert result.file_name == "test.pdf"
        assert result.chunks == 2
        assert result.pages == 5
        assert "MB" in result.file_size
    
    @patch('app.document_processor.os.remove')
    async def test_process_document_error(self, mock_remove, processor, mock_file):
        """Test document processing with error"""
        # Mock file operations to raise an error
        with patch('builtins.open', mock_open()) as mock_file_open:
            mock_file_open.side_effect = Exception("File operation error")
            
            with pytest.raises(Exception) as exc_info:
                await processor.process_document(mock_file)
            assert "Failed to process document" in str(exc_info.value)
    
    def test_text_splitter_initialization(self, processor):
        """Test text splitter is properly initialized"""
        assert processor.text_splitter is not None
        assert processor.text_splitter._chunk_size == 1000
        assert processor.text_splitter._chunk_overlap == 200
    
    async def test_chunk_metadata_includes_page_numbers(self, processor):
        """Test that chunks include page number information when available"""
        sample_text = "--- Page 1 ---\nContent from page 1\n\n--- Page 2 ---\nContent from page 2"
        filename = "test.pdf"
        metadata = {"title": "Test Document"}
        
        chunks = await processor._create_chunks(sample_text, filename, metadata)
        
        # Check if page numbers are extracted correctly
        page_numbers = [chunk.page_number for chunk in chunks if chunk.page_number is not None]
        assert len(page_numbers) > 0  # At least some chunks should have page numbers
    
    async def test_chunk_size_limit(self, processor):
        """Test that chunk count is limited per document"""
        # Create very long text that would normally create many chunks
        sample_text = "Sample sentence. " * 1000  # Very long text
        filename = "test.pdf"
        metadata = {"title": "Test Document"}
        
        chunks = await processor._create_chunks(sample_text, filename, metadata)
        
        # Should be limited by max_chunks_per_document setting
        assert len(chunks) <= 100  # max_chunks_per_document from config
