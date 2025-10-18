"""
Utility functions for LearnMate AI Backend
Helper functions for file handling, validation, and common operations
"""

import os
import uuid
import logging
from typing import Optional
import magic
from fastapi import UploadFile

logger = logging.getLogger(__name__)

def generate_session_id() -> str:
    """Generate a unique session ID for conversations"""
    return f"session-{uuid.uuid4().hex[:8]}"

def validate_file_type(filename: str) -> bool:
    """
    Validate if file is a PDF based on extension
    
    Args:
        filename: Name of the file
        
    Returns:
        bool: True if file is a PDF
    """
    if not filename:
        return False
    
    # Check file extension
    allowed_extensions = ['.pdf']
    file_extension = os.path.splitext(filename.lower())[1]
    
    return file_extension in allowed_extensions

def validate_file_magic_number(file_path: str) -> bool:
    """
    Validate file type using magic numbers (more secure than extension)
    
    Args:
        file_path: Path to the file
        
    Returns:
        bool: True if file is a valid PDF
    """
    try:
        mime_type = magic.from_file(file_path, mime=True)
        return mime_type == 'application/pdf'
    except Exception as e:
        logger.warning(f"Could not validate magic number: {e}")
        return False

async def get_file_size_mb(file: UploadFile) -> float:
    """
    Get file size in MB
    
    Args:
        file: Uploaded file object
        
    Returns:
        float: File size in MB
    """
    try:
        # Read file content to get size
        content = await file.read()
        await file.seek(0)  # Reset file pointer
        return len(content) / (1024 * 1024)
    except Exception as e:
        logger.error(f"Error getting file size: {e}")
        return 0.0

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for safe storage
    
    Args:
        filename: Original filename
        
    Returns:
        str: Sanitized filename
    """
    # Remove path components
    filename = os.path.basename(filename)
    
    # Replace dangerous characters
    dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    for char in dangerous_chars:
        filename = filename.replace(char, '_')
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:250] + ext
    
    return filename

def format_file_size(size_bytes: int) -> str:
    """
    Format file size in human-readable format
    
    Args:
        size_bytes: Size in bytes
        
    Returns:
        str: Formatted size string
    """
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f}{size_names[i]}"

def ensure_directory_exists(directory_path: str):
    """
    Ensure directory exists, create if it doesn't
    
    Args:
        directory_path: Path to directory
    """
    try:
        os.makedirs(directory_path, exist_ok=True)
    except Exception as e:
        logger.error(f"Error creating directory {directory_path}: {e}")
        raise

def clean_old_files(directory: str, max_age_days: int = 30):
    """
    Clean old files from directory
    
    Args:
        directory: Directory to clean
        max_age_days: Maximum age of files in days
    """
    try:
        import time
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 60 * 60
        
        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            if os.path.isfile(file_path):
                file_age = current_time - os.path.getmtime(file_path)
                if file_age > max_age_seconds:
                    os.remove(file_path)
                    logger.info(f"Removed old file: {filename}")
                    
    except Exception as e:
        logger.error(f"Error cleaning old files: {e}")

def validate_question_input(question: str) -> bool:
    """
    Validate question input
    
    Args:
        question: User question
        
    Returns:
        bool: True if question is valid
    """
    if not question or not question.strip():
        return False
    
    # Check for minimum length
    if len(question.strip()) < 3:
        return False
    
    # Check for maximum length
    if len(question) > 1000:
        return False
    
    return True

def extract_keywords(text: str, max_keywords: int = 10) -> list:
    """
    Extract keywords from text (simple implementation)
    
    Args:
        text: Input text
        max_keywords: Maximum number of keywords
        
    Returns:
        list: List of keywords
    """
    try:
        import re
        from collections import Counter
        
        # Simple keyword extraction
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        
        # Remove common stop words
        stop_words = {
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
            'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'is', 'are',
            'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'must', 'can', 'shall', 'a', 'an', 'as', 'if', 'when', 'where',
            'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
            'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
            'so', 'than', 'too', 'very', 'just', 'now'
        }
        
        filtered_words = [word for word in words if word not in stop_words]
        
        # Count word frequency
        word_counts = Counter(filtered_words)
        
        # Return most common keywords
        return [word for word, count in word_counts.most_common(max_keywords)]
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return []

def log_api_request(endpoint: str, method: str, user_agent: Optional[str] = None):
    """
    Log API request for monitoring
    
    Args:
        endpoint: API endpoint
        method: HTTP method
        user_agent: User agent string
    """
    logger.info(f"API Request: {method} {endpoint} - User-Agent: {user_agent or 'Unknown'}")

def log_api_response(endpoint: str, status_code: int, response_time: float):
    """
    Log API response for monitoring
    
    Args:
        endpoint: API endpoint
        status_code: HTTP status code
        response_time: Response time in seconds
    """
    logger.info(f"API Response: {endpoint} - Status: {status_code} - Time: {response_time:.3f}s")

def create_error_response(message: str, status_code: int = 500) -> dict:
    """
    Create standardized error response
    
    Args:
        message: Error message
        status_code: HTTP status code
        
    Returns:
        dict: Error response
    """
    return {
        "detail": message,
        "status_code": status_code,
        "timestamp": "2025-10-18T10:00:00Z"  # This should be dynamic
    }
