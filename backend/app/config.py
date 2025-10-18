"""
Configuration management for LearnMate AI Backend
Uses pydantic-settings for environment variable handling
"""

from pydantic_settings import BaseSettings
from typing import List
import os
from datetime import datetime

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # OpenAI Configuration
    openai_api_key: str
    
    # Application Settings
    app_name: str = "LearnMate AI"
    app_version: str = "1.0.0"
    environment: str = "development"
    
    # File Upload Settings
    upload_dir: str = "./data/uploads"
    max_upload_size: int = 10485760  # 10MB in bytes
    allowed_extensions: str = "pdf"
    
    # Vector Store Settings
    vector_db_dir: str = "./data/vectorstore"
    embedding_model: str = "text-embedding-ada-002"
    
    # LLM Settings
    llm_model: str = "gpt-3.5-turbo"
    llm_temperature: float = 0.7
    max_tokens: int = 500
    
    # Server Settings
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    
    # CORS Settings
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8501"
    
    # Document Processing Settings
    chunk_size: int = 1000
    chunk_overlap: int = 200
    max_chunks_per_document: int = 100
    
    # RAG Settings
    top_k_chunks: int = 4
    similarity_threshold: float = 0.7
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS origins string to list"""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    @property
    def allowed_extensions_list(self) -> List[str]:
        """Convert allowed extensions string to list"""
        return [ext.strip() for ext in self.allowed_extensions.split(",")]
    
    def get_current_time(self) -> str:
        """Get current timestamp in ISO format"""
        return datetime.now().isoformat()
    
    def ensure_directories(self):
        """Ensure required directories exist"""
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.vector_db_dir, exist_ok=True)

# Global settings instance
settings = Settings()

# Ensure directories exist on import
settings.ensure_directories()
