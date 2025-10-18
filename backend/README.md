# LearnMate AI Backend 🚀

A powerful FastAPI-based backend for the LearnMate AI Personal Learning Assistant application. This backend provides AI-powered document processing, question answering, summarization, quiz generation, and real-time voice interaction capabilities.

## ✨ Features

### 📄 **Document Processing**
- Upload and process PDF documents with intelligent text extraction
- Automatic document chunking for optimal RAG performance
- Vector-based storage using FAISS for fast similarity search

### 🤖 **AI-Powered Chat**
- Ask questions about uploaded documents using RAG (Retrieval-Augmented Generation)
- Maintain conversation context and history
- Source references for transparency

### 📝 **Smart Summarization**
- Generate comprehensive summaries of documents
- Extract key insights and main topics
- Context-aware summarization

### 🧠 **Quiz Generation**
- Create intelligent quizzes based on document content
- Multiple choice questions with explanations
- Configurable difficulty levels and question counts

### 🎤 **Voice Learning Assistant**
- Real-time voice interaction using WebSocket connections
- Speech-to-text using OpenAI Whisper API
- Text-to-speech using OpenAI TTS API
- Natural conversation flow with document context

### 📊 **Learning Analytics**
- Track user learning sessions and progress
- Monitor quiz performance and chat interactions
- Comprehensive analytics dashboard data

### 💬 **Conversation Memory**
- Persistent conversation storage
- Context maintenance across sessions
- Multiple conversation management

### 🔍 **Advanced RAG System**
- Retrieval-Augmented Generation for accurate answers
- Vector similarity search using FAISS
- LangChain integration for robust AI processing
- LangFuse observability and monitoring

## 🛠️ Technology Stack

- **Framework**: FastAPI (Python 3.10+)
- **AI/LLM**: OpenAI API (GPT-3.5-turbo, Whisper, TTS)
- **LLM Framework**: LangChain
- **Vector Database**: FAISS
- **Document Processing**: PyPDF2
- **Observability**: LangFuse
- **Real-time Communication**: WebSockets
- **Environment**: Python virtual environment

## 🚀 Quick Start

### Prerequisites

- Python 3.10 or higher
- OpenAI API key
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LearnMateAI/backend
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
   cp env.example .env
   # Edit .env and add your OpenAI API key
   ```

5. **Run the application**
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at `http://localhost:8000`

## 📚 API Documentation

Once the server is running, you can access:
- **Interactive API docs**: `http://localhost:8000/docs`
- **ReDoc documentation**: `http://localhost:8000/redoc`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check and API status |
| POST | `/upload` | Upload PDF documents |
| GET | `/documents` | List uploaded documents |
| DELETE | `/documents/{filename}` | Delete specific document |
| GET | `/current-session-documents` | Get current session documents |
| POST | `/ask` | Ask questions about documents |
| POST | `/summarize` | Generate document summaries |
| POST | `/generate-quiz` | Create quizzes from documents |
| GET | `/conversations` | List user conversations |
| GET | `/conversations/{conversation_id}` | Get specific conversation |
| GET | `/conversations/user/{user_id}` | Get user's conversations |
| GET | `/analytics/user/{user_id}` | Get user analytics |
| GET | `/analytics/global` | Get global analytics |
| POST | `/analytics/track-quiz` | Track quiz completion |
| WebSocket | `/voice/ws/{client_id}` | Real-time voice chat |
| GET | `/voice/status` | Voice agent status |
| GET | `/voice/test` | Test voice processing |

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional - LangFuse for observability
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key_here
LANGFUSE_SECRET_KEY=your_langfuse_secret_key_here
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_ENABLED=false

# Application Settings
APP_NAME=LearnMate AI
APP_VERSION=1.0.0
ENVIRONMENT=development

# File Upload Settings
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_SIZE=10485760  # 10MB in bytes
ALLOWED_EXTENSIONS=pdf

# Server Settings
HOST=0.0.0.0
PORT=8000
RELOAD=true

# CORS Settings
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8501,http://localhost:8080,http://localhost:8081,http://localhost:8082
```

## 💡 Usage Examples

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
    "session_documents": ["document.pdf"],
    "conversation_id": "session-123",
    "user_id": "user-123"
  }'
```

### Generate Summary
```bash
curl -X POST "http://localhost:8000/summarize" \
  -H "Content-Type: application/json" \
  -d '{
    "session_documents": ["document.pdf"],
    "user_id": "user-123"
  }'
```

### Generate Quiz
```bash
curl -X POST "http://localhost:8000/generate-quiz" \
  -H "Content-Type: application/json" \
  -d '{
    "num_questions": 5,
    "difficulty": "medium",
    "session_documents": ["document.pdf"],
    "user_id": "user-123"
  }'
```

### Voice Chat WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8000/voice/ws/your_client_id');

// Send voice message
ws.send(JSON.stringify({
  type: "voice",
  audio: base64AudioData,
  timestamp: new Date().toISOString()
}));
```

## 🏗️ Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app and routes
│   ├── document_processor.py   # PDF processing logic
│   ├── vector_store.py         # FAISS vector store
│   ├── rag_chain.py            # RAG implementation
│   ├── voice_agent.py          # Voice chat system
│   ├── voice_processing.py     # STT/TTS processing
│   ├── conversation_memory.py  # Chat memory management
│   ├── learning_analytics.py   # Analytics tracking
│   └── langfuse_config.py      # Observability config
├── data/
│   ├── uploads/                # Uploaded PDF files
│   ├── vectorstore/            # FAISS index storage
│   ├── conversations.json      # Conversation storage
│   ├── analytics.json          # Analytics data
│   └── documents.json          # Document metadata
├── requirements.txt
├── env.example
└── README.md
```

## 🔍 Features in Detail

### RAG (Retrieval-Augmented Generation)
- Documents are processed and stored in vector embeddings
- Questions are matched against relevant document chunks
- AI generates answers based on retrieved context
- Provides source references for transparency

### Voice Learning System
- Real-time WebSocket communication
- Speech-to-text using OpenAI Whisper API
- Text-to-speech using OpenAI TTS API with multiple voice options
- Natural conversation flow with document context
- Transcribed speech display for clarity

### Learning Analytics
- Tracks document uploads and processing
- Monitors quiz attempts and scores
- Records chat interactions and conversation history
- Provides insights into learning patterns
- Global and user-specific analytics

### Conversation Memory
- Persistent conversation storage in JSON format
- Context maintenance across sessions
- Multiple conversation management per user
- Message history with timestamps

## 🚨 Troubleshooting

### Common Issues

1. **OpenAI API Key Error**
   - Ensure your API key is correctly set in `.env`
   - Check that you have sufficient API credits

2. **Voice Chat Not Working**
   - Ensure WebSocket connection is established
   - Check that voice processing service is initialized
   - Verify OpenAI Whisper and TTS API access

3. **Documents Not Processing**
   - Verify PDF files are not corrupted
   - Check file size limits (10MB default)
   - Ensure vector store is properly initialized

4. **Vector Store Issues**
   - Clear vector store: `curl -X POST "http://localhost:8000/clear-documents"`
   - Check FAISS installation and compatibility

### Debug Mode

Enable debug logging by checking:
- Backend logs: Terminal output when running uvicorn
- LangFuse dashboard: If enabled, monitor traces and performance

## 📊 Performance Metrics

- **Document upload**: < 5 seconds (10MB PDF)
- **Question answering**: < 3 seconds
- **Summary generation**: < 5 seconds
- **Quiz generation**: < 7 seconds
- **Voice processing**: < 2 seconds (STT + TTS)
- **API response time**: < 100ms (excluding LLM calls)

## 🔒 Security Considerations

- ✅ File type validation
- ✅ File size limits
- ✅ Input sanitization
- ✅ CORS configuration
- ✅ API key protection
- ✅ Error handling without information leakage
- ✅ WebSocket connection validation

## 📈 Monitoring and Logging

The application includes comprehensive logging for:
- API requests and responses
- Document processing steps
- LLM API calls and costs
- Voice processing operations
- WebSocket connections
- Errors and exceptions
- Performance metrics
- LangFuse traces (if enabled)

## 🧪 Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest tests/

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_voice_agent.py -v
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build image
docker build -t learnmate-backend .

# Run container
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=your_api_key \
  -v $(pwd)/data:/app/data \
  learnmate-backend
```

### Production Considerations

- Use environment-specific configurations
- Set up proper logging and monitoring
- Configure reverse proxy (nginx)
- Set up SSL/TLS certificates
- Implement rate limiting
- Set up database for production use

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for providing the AI APIs (GPT, Whisper, TTS)
- LangChain for the RAG framework
- FastAPI for the robust backend framework
- FAISS for efficient vector similarity search
- LangFuse for observability and monitoring

---

**Made with ❤️ for learners everywhere**

A powerful backend that transforms learning with AI-powered document analysis, voice interaction, and intelligent conversation management.