import logging
import PyPDF2
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from .errors import UserFacingError

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Handle document processing, chunking, and text extraction"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
    
    def extract_text_from_pdf(self, file_content: bytes) -> str:
        """Extract text from PDF file content"""
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            text = ""
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n"
            
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise UserFacingError("This PDF couldn't be read. It may be encrypted or damaged.", status_code=422)
    
    def process_document(self, filename: str, content: bytes) -> List[Document]:
        """Process document and return chunked documents"""
        try:
            # Extract text
            text = self.extract_text_from_pdf(content)
            
            if not text.strip():
                raise UserFacingError("No selectable text found in this PDF. Scanned PDFs aren't supported yet.", status_code=422)
            
            # Create document object
            doc = Document(
                page_content=text,
                metadata={
                    "source": filename,
                    "file_size": len(content),
                    "text_length": len(text)
                }
            )
            
            # Split into chunks
            chunks = self.text_splitter.split_documents([doc])
            
            logger.info(f"Processed document {filename}: {len(chunks)} chunks created")
            return chunks
            
        except UserFacingError:
            raise
        except Exception as e:
            logger.error(f"Error processing document {filename}: {e}")
            raise Exception(f"Failed to process document: {str(e)}")

import io