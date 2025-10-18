"""
Document processing logic for LearnMate AI Backend
Handles PDF text extraction, chunking, and metadata processing
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import PyPDF2
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

from .config import settings
from .models import ProcessedDocument, DocumentChunk, DocumentDetails

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Handles PDF document processing and text extraction"""
    
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
    
    async def process_document(self, file) -> DocumentDetails:
        """
        Process uploaded PDF document
        
        Args:
            file: Uploaded file object
            
        Returns:
            DocumentDetails: Processing results
        """
        try:
            # Save uploaded file temporarily
            file_path = os.path.join(settings.upload_dir, file.filename)
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # Extract text and metadata
            text, pages, metadata = await self._extract_pdf_content(file_path)
            
            # Create text chunks
            chunks = await self._create_chunks(text, file.filename, metadata)
            
            # Clean up temporary file
            os.remove(file_path)
            
            # Create response
            file_size_mb = len(content) / (1024 * 1024)
            
            return DocumentDetails(
                status="success",
                file_name=file.filename,
                chunks=len(chunks),
                pages=pages,
                file_size=f"{file_size_mb:.1f}MB"
            )
            
        except Exception as e:
            logger.error(f"Error processing document {file.filename}: {e}")
            raise Exception(f"Failed to process document: {str(e)}")
    
    async def _extract_pdf_content(self, file_path: str) -> tuple[str, int, Dict[str, Any]]:
        """
        Extract text content from PDF file
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            tuple: (text_content, page_count, metadata)
        """
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Extract text from all pages
                text_content = ""
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        text_content += f"\n\n--- Page {page_num + 1} ---\n\n"
                        text_content += page_text
                    except Exception as e:
                        logger.warning(f"Error extracting text from page {page_num + 1}: {e}")
                        continue
                
                # Extract metadata
                metadata = {
                    "title": pdf_reader.metadata.get("/Title", "") if pdf_reader.metadata else "",
                    "author": pdf_reader.metadata.get("/Author", "") if pdf_reader.metadata else "",
                    "subject": pdf_reader.metadata.get("/Subject", "") if pdf_reader.metadata else "",
                    "creator": pdf_reader.metadata.get("/Creator", "") if pdf_reader.metadata else "",
                    "producer": pdf_reader.metadata.get("/Producer", "") if pdf_reader.metadata else "",
                    "creation_date": str(pdf_reader.metadata.get("/CreationDate", "")) if pdf_reader.metadata else "",
                    "modification_date": str(pdf_reader.metadata.get("/ModDate", "")) if pdf_reader.metadata else "",
                    "total_pages": len(pdf_reader.pages)
                }
                
                return text_content, len(pdf_reader.pages), metadata
                
        except Exception as e:
            logger.error(f"Error extracting PDF content: {e}")
            raise Exception(f"Failed to extract PDF content: {str(e)}")
    
    async def _create_chunks(self, text: str, filename: str, metadata: Dict[str, Any]) -> List[DocumentChunk]:
        """
        Split text into chunks for vector storage
        
        Args:
            text: Full document text
            filename: Original filename
            metadata: Document metadata
            
        Returns:
            List[DocumentChunk]: List of text chunks
        """
        try:
            # Create LangChain documents
            doc = Document(
                page_content=text,
                metadata={
                    "source": filename,
                    "upload_date": datetime.now().isoformat(),
                    **metadata
                }
            )
            
            # Split into chunks
            chunks = self.text_splitter.split_documents([doc])
            
            # Convert to DocumentChunk objects
            document_chunks = []
            for i, chunk in enumerate(chunks):
                # Extract page number from content if available
                page_number = None
                if "--- Page" in chunk.page_content:
                    try:
                        page_line = [line for line in chunk.page_content.split("\n") if "--- Page" in line][0]
                        page_number = int(page_line.split("Page")[1].split("---")[0].strip())
                    except:
                        pass
                
                document_chunk = DocumentChunk(
                    content=chunk.page_content,
                    metadata=chunk.metadata,
                    page_number=page_number,
                    chunk_index=i
                )
                document_chunks.append(document_chunk)
            
            # Limit number of chunks per document
            if len(document_chunks) > settings.max_chunks_per_document:
                document_chunks = document_chunks[:settings.max_chunks_per_document]
                logger.warning(f"Limited chunks for {filename} to {settings.max_chunks_per_document}")
            
            return document_chunks
            
        except Exception as e:
            logger.error(f"Error creating chunks: {e}")
            raise Exception(f"Failed to create text chunks: {str(e)}")
    
    def validate_pdf_file(self, file_path: str) -> bool:
        """
        Validate that file is a valid PDF
        
        Args:
            file_path: Path to file
            
        Returns:
            bool: True if valid PDF
        """
        try:
            with open(file_path, 'rb') as file:
                # Check PDF magic number
                header = file.read(4)
                if header != b'%PDF':
                    return False
                
                # Try to read PDF
                file.seek(0)
                PyPDF2.PdfReader(file)
                return True
                
        except Exception:
            return False
    
    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        """
        Get file information
        
        Args:
            file_path: Path to file
            
        Returns:
            Dict: File information
        """
        try:
            stat = os.stat(file_path)
            return {
                "size": stat.st_size,
                "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting file info: {e}")
            return {}
