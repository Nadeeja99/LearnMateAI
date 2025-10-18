# LearnMate AI Backend

A powerful FastAPI-based backend for the LearnMate AI Personal Learning Assistant application. This backend provides AI-powered document processing, question answering, summarization, and quiz generation capabilities.

## Features

- 📄 **PDF Document Processing**: Upload and process PDF documents with text extraction and chunking
- 🤖 **AI-Powered Chat**: Ask questions about uploaded documents using RAG (Retrieval-Augmented Generation)
- 📝 **Smart Summarization**: Generate comprehensive summaries of documents
- 🧠 **Quiz Generation**: Create intelligent quizzes based on document content
- 🔍 **Vector Search**: Fast similarity search using FAISS vector database
- 💬 **Conversation Memory**: Maintain context across chat sessions
- 🚀 **High Performance**: Optimized for speed and scalability

## Technology Stack

- **Framework**: FastAPI (Python 3.10+)
- **AI/LLM**: OpenAI API (GPT-3.5-turbo/GPT-4)
- **LLM Framework**: LangChain
- **Vector Database**: FAISS
- **Document Processing**: PyPDF2
- **Environment**: Python virtual environment

## Quick Start

### Prerequisites

- Python 3.10 or higher
- OpenAI API key
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd learnmate-backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

5. **Run the application**
   ```bash
   uvicorn app.main:app --reload
   ```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access:
- **Interactive API docs**: `http://localhost:8000/docs`
- **ReDoc documentation**: `http://localhost:8000/redoc`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/upload` | Upload PDF document |
| POST | `/ask` | Ask questions about documents |
| POST | `/summarize` | Generate document summary |
| POST | `/generate-quiz` | Generate quiz questions |
| GET | `/documents` | List uploaded documents |
| DELETE | `/documents/{filename}` | Delete document |
| POST | `/clear-memory` | Clear chat memory |

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Application Settings
APP_NAME=LearnMate AI
APP_VERSION=1.0.0
ENVIRONMENT=development

# File Upload Settings
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_SIZE=10485760  # 10MB in bytes
ALLOWED_EXTENSIONS=pdf

# Vector Store Settings
VECTOR_DB_DIR=./data/vectorstore
EMBEDDING_MODEL=text-embedding-ada-002

# LLM Settings
LLM_MODEL=gpt-3.5-turbo
LLM_TEMPERATURE=0.7
MAX_TOKENS=500

# Server Settings
HOST=0.0.0.0
PORT=8000
RELOAD=true

# CORS Settings
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8501
```

## Usage Examples

### Upload a Document

```bash
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@document.pdf"
```

### Ask a Question

```bash
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is machine learning?",
    "conversation_id": "session-123"
  }'
```

### Generate Summary

```bash
curl -X POST "http://localhost:8000/summarize" \
  -H "Content-Type: application/json" \
  -d '{
    "document_name": "machine_learning.pdf"
  }'
```

### Generate Quiz

```bash
curl -X POST "http://localhost:8000/generate-quiz" \
  -H "Content-Type: application/json" \
  -d '{
    "num_questions": 5,
    "difficulty": "medium",
    "document_name": "machine_learning.pdf"
  }'
```

## Development

### Project Structure

```
learnmate-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app and routes
│   ├── config.py               # Configuration management
│   ├── models.py               # Pydantic models
│   ├── document_processor.py  # PDF processing logic
│   ├── vector_store.py         # FAISS vector store
│   ├── rag_chain.py            # RAG implementation
│   └── utils.py                # Helper functions
├── data/
│   ├── uploads/                # Uploaded PDF files
│   └── vectorstore/            # FAISS index storage
├── tests/
│   ├── test_api.py             # API tests
│   └── test_document_processor.py
├── requirements.txt
├── Dockerfile
└── README.md
```

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/

# Run with coverage
pytest --cov=app tests/
```

### Code Quality

```bash
# Format code
black app/ tests/

# Lint code
flake8 app/ tests/

# Type checking
mypy app/
```

## Docker Deployment

### Build and Run

```bash
# Build image
docker build -t learnmate-backend .

# Run container
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=your_api_key \
  -v $(pwd)/data:/app/data \
  learnmate-backend
```

### Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Performance Benchmarks

- **Document upload**: < 5 seconds (10MB PDF)
- **Question answering**: < 3 seconds
- **Summary generation**: < 5 seconds
- **Quiz generation**: < 7 seconds
- **API response time**: < 100ms (excluding LLM calls)

## Security Considerations

- ✅ File type validation (magic numbers)
- ✅ File size limits
- ✅ Input sanitization
- ✅ CORS configuration
- ✅ API key protection
- ✅ Error handling without information leakage

## Monitoring and Logging

The application includes comprehensive logging for:
- API requests and responses
- Document processing steps
- LLM API calls and costs
- Errors and exceptions
- Performance metrics

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/docs`
- Review the logs for debugging information

## Changelog

### Version 1.0.0
- Initial release
- PDF document processing
- RAG-based question answering
- Document summarization
- Quiz generation
- Vector search with FAISS
- Conversation memory
- RESTful API with FastAPI
