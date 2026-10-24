import logging
import os
import pickle
import threading
import faiss
import numpy as np
from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

logger = logging.getLogger(__name__)

class VectorStore:
    """Handle vector storage and retrieval using FAISS.

    Each instance owns one directory (one per session, see sessions.py). Files are only
    created on the first save, so read-only visitors leave nothing on disk.
    """
    
    def __init__(self, openai_api_key: str, store_dir: str = "data/vectorstore"):
        self.embeddings = OpenAIEmbeddings(openai_api_key=openai_api_key)
        self.vector_store: Optional[FAISS] = None
        self.documents: List[Document] = []
        self.store_dir = store_dir
        self.store_path = os.path.join(store_dir, "index")
        self.metadata_path = os.path.join(store_dir, "metadata.pkl")
        # Searches run in worker threads (asyncio.to_thread), so guard concurrent mutation
        self._lock = threading.RLock()
        
        # Try to load existing vector store
        self.load_vector_store()
    
    def add_documents(self, documents: List[Document]) -> None:
        """Add documents to the vector store"""
        with self._lock:
            self._add_documents(documents)

    def _add_documents(self, documents: List[Document]) -> None:
        try:
            if not documents:
                logger.warning("No documents to add")
                return
            
            logger.info(f"Adding {len(documents)} documents to vector store")
            
            if self.vector_store is None:
                # Create new vector store
                self.vector_store = FAISS.from_documents(
                    documents, 
                    self.embeddings
                )
                logger.info("Created new vector store")
            else:
                # Add to existing vector store
                new_store = FAISS.from_documents(documents, self.embeddings)
                self.vector_store.merge_from(new_store)
                logger.info("Merged documents into existing vector store")
            
            # Update documents list
            self.documents.extend(documents)
            
            # Save vector store
            self.save_vector_store()
            
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {e}")
            raise Exception(f"Failed to add documents to vector store: {str(e)}")
    
    def search_similar(self, query: str, k: int = 5, document_names: Optional[List[str]] = None) -> List[Dict]:
        """Search for similar documents, optionally filtered by document names"""
        with self._lock:
            return self._search_similar(query, k, document_names)

    def _search_similar(self, query: str, k: int, document_names: Optional[List[str]]) -> List[Dict]:
        try:
            if self.vector_store is None:
                logger.warning("No vector store available")
                return []
            
            logger.info(f"Searching for {k} similar documents for query: {query[:100]}...")
            
            # Perform similarity search with a larger k to account for filtering
            search_k = k * 3 if document_names else k
            docs = self.vector_store.similarity_search_with_score(query, k=search_k)
            
            results = []
            for doc, score in docs:
                # Filter by document names if specified
                if document_names and doc.metadata.get("source") not in document_names:
                    continue
                    
                result = {
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "score": float(score)
                }
                results.append(result)
                
                # Stop when we have enough results
                if len(results) >= k:
                    break
            
            logger.info(f"Found {len(results)} similar documents")
            return results
            
        except Exception as e:
            logger.error(f"Error searching vector store: {e}")
            raise Exception(f"Failed to search vector store: {str(e)}")
    
    def has_documents(self) -> bool:
        """Check if vector store has any documents"""
        return self.vector_store is not None and len(self.documents) > 0
    
    def get_all_documents(self) -> List[Document]:
        """Get all documents in the vector store"""
        return self.documents.copy()

    def document_summaries(self) -> Dict[str, Dict[str, Any]]:
        """Per-file summary derived from chunk metadata, in upload order"""
        summaries: Dict[str, Dict[str, Any]] = {}
        for doc in self.documents:
            name = doc.metadata.get("source", "unknown")
            entry = summaries.setdefault(name, {
                "filename": name,
                "chunks_count": 0,
                "file_size": doc.metadata.get("file_size"),
                "uploaded_at": doc.metadata.get("uploaded_at"),
            })
            entry["chunks_count"] += 1
        return summaries
    
    def clear_store(self) -> None:
        """Clear the vector store"""
        with self._lock:
            self._clear_store()

    def _clear_store(self) -> None:
        try:
            self.vector_store = None
            self.documents = []
            
            # Remove saved files
            if os.path.exists(self.store_path):
                import shutil
                shutil.rmtree(self.store_path)
            if os.path.exists(self.metadata_path):
                os.remove(self.metadata_path)
            
            logger.info("Vector store cleared")
            
        except Exception as e:
            logger.error(f"Error clearing vector store: {e}")
            raise Exception(f"Failed to clear vector store: {str(e)}")
    
    def save_vector_store(self) -> None:
        """Save vector store to disk"""
        try:
            if self.vector_store is not None:
                os.makedirs(self.store_dir, exist_ok=True)
                self.vector_store.save_local(self.store_path)
                
                # Save metadata separately
                with open(self.metadata_path, 'wb') as f:
                    pickle.dump(self.documents, f)
                
                logger.info("Vector store saved to disk")
                
        except Exception as e:
            logger.error(f"Error saving vector store: {e}")
    
    def delete_document(self, document_name: str) -> None:
        """Delete a specific document from the vector store"""
        with self._lock:
            self._delete_document(document_name)

    def _delete_document(self, document_name: str) -> None:
        try:
            if not self.vector_store:
                logger.warning("No vector store to delete from")
                return
            
            # Filter out documents with the specified source
            original_count = len(self.documents)
            self.documents = [doc for doc in self.documents if doc.metadata.get("source") != document_name]
            
            if len(self.documents) == original_count:
                logger.warning(f"Document '{document_name}' not found in vector store")
                return
            
            # Rebuild vector store with remaining documents
            if self.documents:
                texts = [doc.page_content for doc in self.documents]
                metadatas = [doc.metadata for doc in self.documents]
                
                self.vector_store = FAISS.from_texts(
                    texts, 
                    self.embeddings, 
                    metadatas=metadatas
                )
                
                # Save updated vector store
                self.save_vector_store()
                logger.info(f"Document '{document_name}' deleted. {len(self.documents)} documents remaining")
            else:
                # No documents left, clear the store
                self._clear_store()
                logger.info(f"Document '{document_name}' deleted. Vector store is now empty")
                
        except Exception as e:
            logger.error(f"Error deleting document '{document_name}': {e}")
            raise

    def load_vector_store(self) -> None:
        """Load vector store from disk"""
        try:
            if os.path.exists(self.store_path) and os.path.exists(self.metadata_path):
                self.vector_store = FAISS.load_local(
                    self.store_path, 
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                
                # Load metadata
                with open(self.metadata_path, 'rb') as f:
                    self.documents = pickle.load(f)
                
                logger.info(f"Loaded vector store with {len(self.documents)} documents")
            else:
                logger.info("No existing vector store found")
                
        except Exception as e:
            logger.error(f"Error loading vector store: {e}")
            logger.info("Starting with empty vector store")
            self.vector_store = None
            self.documents = []