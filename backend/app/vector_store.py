"""
Vector store management for LearnMate AI Backend
Handles FAISS vector database operations for document embeddings
"""

import os
import pickle
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import faiss
from langchain.embeddings import OpenAIEmbeddings
from langchain.schema import Document

from .config import settings
from .models import DocumentChunk, VectorSearchResult, DocumentInfo

logger = logging.getLogger(__name__)

class VectorStoreManager:
    """Manages FAISS vector store for document embeddings"""
    
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=settings.openai_api_key,
            model=settings.embedding_model
        )
        self.index = None
        self.documents = {}  # filename -> document info
        self.chunk_metadata = []  # metadata for each vector
        self.dimension = 1536  # OpenAI ada-002 embedding dimension
        
    async def load_index(self):
        """Load existing FAISS index from disk"""
        try:
            index_path = os.path.join(settings.vector_db_dir, "faiss_index.bin")
            metadata_path = os.path.join(settings.vector_db_dir, "metadata.pkl")
            
            if os.path.exists(index_path) and os.path.exists(metadata_path):
                # Load FAISS index
                self.index = faiss.read_index(index_path)
                
                # Load metadata
                with open(metadata_path, 'rb') as f:
                    data = pickle.load(f)
                    self.documents = data.get('documents', {})
                    self.chunk_metadata = data.get('chunk_metadata', [])
                
                logger.info(f"Loaded vector store with {self.index.ntotal} vectors")
            else:
                # Create new index
                self.index = faiss.IndexFlatIP(self.dimension)  # Inner product for cosine similarity
                logger.info("Created new vector store")
                
        except Exception as e:
            logger.error(f"Error loading vector store: {e}")
            # Create new index on error
            self.index = faiss.IndexFlatIP(self.dimension)
    
    async def save_index(self):
        """Save FAISS index to disk"""
        try:
            os.makedirs(settings.vector_db_dir, exist_ok=True)
            
            index_path = os.path.join(settings.vector_db_dir, "faiss_index.bin")
            metadata_path = os.path.join(settings.vector_db_dir, "metadata.pkl")
            
            # Save FAISS index
            faiss.write_index(self.index, index_path)
            
            # Save metadata
            data = {
                'documents': self.documents,
                'chunk_metadata': self.chunk_metadata
            }
            with open(metadata_path, 'wb') as f:
                pickle.dump(data, f)
            
            logger.info(f"Saved vector store with {self.index.ntotal} vectors")
            
        except Exception as e:
            logger.error(f"Error saving vector store: {e}")
    
    async def add_document(self, document_details: Any, chunks: List[DocumentChunk]):
        """
        Add document chunks to vector store
        
        Args:
            document_details: Document processing details
            chunks: List of document chunks
        """
        try:
            if not chunks:
                logger.warning("No chunks to add")
                return
            
            # Generate embeddings for chunks
            texts = [chunk.content for chunk in chunks]
            embeddings = await self.embeddings.aembed_documents(texts)
            
            # Convert to numpy array
            embeddings_array = np.array(embeddings).astype('float32')
            
            # Normalize for cosine similarity
            faiss.normalize_L2(embeddings_array)
            
            # Add to FAISS index
            self.index.add(embeddings_array)
            
            # Store metadata
            for i, chunk in enumerate(chunks):
                metadata = {
                    'filename': document_details.file_name,
                    'chunk_index': chunk.chunk_index,
                    'page_number': chunk.page_number,
                    'upload_date': datetime.now().isoformat(),
                    **chunk.metadata
                }
                self.chunk_metadata.append(metadata)
            
            # Update document info
            self.documents[document_details.file_name] = {
                'filename': document_details.file_name,
                'upload_date': datetime.now().isoformat(),
                'file_size': document_details.file_size,
                'pages': document_details.pages,
                'chunks': document_details.chunks
            }
            
            logger.info(f"Added {len(chunks)} chunks for document {document_details.file_name}")
            
        except Exception as e:
            logger.error(f"Error adding document to vector store: {e}")
            raise
    
    async def search_similar(self, query: str, k: int = None) -> List[VectorSearchResult]:
        """
        Search for similar chunks using vector similarity
        
        Args:
            query: Search query
            k: Number of results to return
            
        Returns:
            List[VectorSearchResult]: Similar chunks
        """
        try:
            if self.index is None or self.index.ntotal == 0:
                return []
            
            k = k or settings.top_k_chunks
            
            # Generate query embedding
            query_embedding = await self.embeddings.aembed_query(query)
            query_vector = np.array([query_embedding]).astype('float32')
            faiss.normalize_L2(query_vector)
            
            # Search
            scores, indices = self.index.search(query_vector, min(k, self.index.ntotal))
            
            # Format results
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:  # No more results
                    break
                
                if score >= settings.similarity_threshold:
                    metadata = self.chunk_metadata[idx]
                    result = VectorSearchResult(
                        content=metadata.get('content', ''),
                        score=float(score),
                        metadata=metadata,
                        source_document=metadata.get('filename', '')
                    )
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching vector store: {e}")
            return []
    
    async def list_documents(self) -> List[DocumentInfo]:
        """List all documents in the vector store"""
        try:
            documents = []
            for filename, info in self.documents.items():
                doc_info = DocumentInfo(
                    filename=filename,
                    upload_date=info['upload_date'],
                    file_size=info['file_size'],
                    pages=info['pages'],
                    chunks=info['chunks'],
                    metadata={}
                )
                documents.append(doc_info)
            
            return documents
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []
    
    async def get_document_info(self, filename: str) -> Optional[DocumentInfo]:
        """Get information about a specific document"""
        try:
            if filename not in self.documents:
                return None
            
            info = self.documents[filename]
            return DocumentInfo(
                filename=filename,
                upload_date=info['upload_date'],
                file_size=info['file_size'],
                pages=info['pages'],
                chunks=info['chunks'],
                metadata={}
            )
            
        except Exception as e:
            logger.error(f"Error getting document info: {e}")
            return None
    
    async def remove_document(self, filename: str) -> bool:
        """
        Remove document from vector store
        
        Args:
            filename: Document filename to remove
            
        Returns:
            bool: True if document was removed
        """
        try:
            if filename not in self.documents:
                return False
            
            # Find chunks belonging to this document
            chunks_to_remove = []
            for i, metadata in enumerate(self.chunk_metadata):
                if metadata.get('filename') == filename:
                    chunks_to_remove.append(i)
            
            if not chunks_to_remove:
                logger.warning(f"No chunks found for document {filename}")
                return False
            
            # Remove from FAISS index (this is complex, so we'll rebuild)
            await self._rebuild_index_without_document(filename)
            
            # Remove from documents dict
            del self.documents[filename]
            
            logger.info(f"Removed document {filename} with {len(chunks_to_remove)} chunks")
            return True
            
        except Exception as e:
            logger.error(f"Error removing document: {e}")
            return False
    
    async def _rebuild_index_without_document(self, filename_to_remove: str):
        """Rebuild FAISS index without specified document"""
        try:
            # Create new index
            new_index = faiss.IndexFlatIP(self.dimension)
            new_metadata = []
            
            # Re-embed all documents except the one to remove
            for filename, info in self.documents.items():
                if filename == filename_to_remove:
                    continue
                
                # Get chunks for this document
                doc_chunks = [meta for meta in self.chunk_metadata 
                            if meta.get('filename') == filename]
                
                if doc_chunks:
                    # Re-embed chunks
                    texts = [chunk.get('content', '') for chunk in doc_chunks]
                    embeddings = await self.embeddings.aembed_documents(texts)
                    embeddings_array = np.array(embeddings).astype('float32')
                    faiss.normalize_L2(embeddings_array)
                    
                    # Add to new index
                    new_index.add(embeddings_array)
                    new_metadata.extend(doc_chunks)
            
            # Replace old index
            self.index = new_index
            self.chunk_metadata = new_metadata
            
        except Exception as e:
            logger.error(f"Error rebuilding index: {e}")
            raise
    
    def has_documents(self) -> bool:
        """Check if vector store has any documents"""
        return len(self.documents) > 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get vector store statistics"""
        return {
            "total_documents": len(self.documents),
            "total_vectors": self.index.ntotal if self.index else 0,
            "dimension": self.dimension
        }
