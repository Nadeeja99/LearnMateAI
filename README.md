# LearnMate AI 🚀

**Transform Your Learning with AI-Powered Document Analysis and Voice Chat**

LearnMate AI is a cutting-edge personal learning assistant that combines document processing, RAG (Retrieval-Augmented Generation), and real-time voice interaction to revolutionize how you study and learn.

## ✨ Key Features

### 📄 **Document Processing**
- Upload PDF documents with instant processing
- Intelligent text extraction and chunking
- Vector-based document storage for fast retrieval

### 🤖 **AI-Powered Chat**
- Ask questions about your documents using natural language
- Get contextual answers with source references
- Maintain conversation history and context

### 📝 **Smart Summarization**
- Generate comprehensive summaries of uploaded documents
- Extract key insights and main topics
- Save time on lengthy reading materials

### 🧠 **Quiz Generation**
- Create intelligent quizzes based on document content
- Multiple choice questions with explanations
- Track your learning progress and scores

### 🎤 **Voice Learning Assistant**
- Real-time voice interaction with your documents
- Speech-to-text transcription with OpenAI Whisper
- Text-to-speech responses with natural voices
- Display transcribed speech for clarity

### 📊 **Learning Analytics**
- Track your learning sessions and progress
- Monitor quiz performance and chat interactions
- View comprehensive analytics dashboard

### 💬 **Conversation Memory**
- Maintain context across chat sessions
- Create and manage multiple conversations
- Persistent conversation history

### 🔍 **Advanced RAG System**
- Retrieval-Augmented Generation for accurate answers
- Vector similarity search using FAISS
- LangChain integration for robust AI processing

## 🛠️ Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **AI/LLM**: OpenAI API (GPT-3.5-turbo, Whisper, TTS)
- **LLM Framework**: LangChain
- **Vector Database**: FAISS
- **Document Processing**: PyPDF2
- **Observability**: LangFuse
- **Real-time Communication**: WebSockets

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **State Management**: React Hooks

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10 or higher
- **OpenAI API Key** (required)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LearnMateAI
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Environment Configuration**
   ```bash
   cd ../backend
   cp env.example .env
   # Edit .env and add your OpenAI API key:
   # OPENAI_API_KEY=your_openai_api_key_here
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   source venv/bin/activate
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   - Frontend: `http://localhost:8080` (or the port shown in terminal)
   - Backend API: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`

## 📖 How to Use

### 1. Upload Documents
- Navigate to the Upload section
- Drag and drop or select PDF files
- Wait for processing to complete

### 2. Chat with Your Documents
- Go to the Chat section
- Ask questions about your uploaded documents
- Get instant, contextual answers

### 3. Generate Summaries
- Use the Summary section
- Click "Generate Summary" to get document overviews
- Review key insights and main topics

### 4. Create Quizzes
- Visit the Quiz section
- Generate practice questions from your documents
- Take quizzes and track your performance

### 5. Voice Learning
- Connect to the Voice Chat
- Speak naturally to ask questions
- Get voice responses and see transcribed text

### 6. View Analytics
- Check the Analytics dashboard
- Monitor your learning progress
- Track quiz scores and chat interactions

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

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
```

### Voice Chat Configuration

The voice chat supports multiple voice options:
- **Alloy**: Neutral, clear voice (default)
- **Echo**: Male voice
- **Fable**: British accent
- **Onyx**: Deep, authoritative voice
- **Nova**: Young, energetic voice
- **Shimmer**: Soft, gentle voice

## 📚 API Documentation

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload PDF documents |
| GET | `/documents` | List uploaded documents |
| DELETE | `/documents/{filename}` | Delete specific document |
| POST | `/ask` | Ask questions about documents |
| POST | `/summarize` | Generate document summaries |
| POST | `/generate-quiz` | Create quizzes from documents |
| GET | `/conversations` | List user conversations |
| GET | `/analytics/user/{user_id}` | Get user analytics |
| WebSocket | `/voice/ws/{client_id}` | Real-time voice chat |

### WebSocket Voice Chat

Connect to voice chat using WebSocket:
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
LearnMateAI/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application
│   │   ├── document_processor.py   # PDF processing
│   │   ├── vector_store.py        # FAISS vector database
│   │   ├── rag_chain.py           # RAG implementation
│   │   ├── voice_agent.py         # Voice chat system
│   │   ├── voice_processing.py    # STT/TTS processing
│   │   ├── conversation_memory.py # Chat memory
│   │   ├── learning_analytics.py  # Analytics tracking
│   │   └── langfuse_config.py     # Observability config
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── app/               # Main app components
│   │   │   └── ui/                # Reusable UI components
│   │   ├── pages/                 # Application pages
│   │   ├── hooks/                 # Custom React hooks
│   │   └── lib/                   # Utility functions
│   ├── package.json
│   └── README.md
└── README.md
```

## 🔍 Features in Detail

### RAG (Retrieval-Augmented Generation)
- Documents are processed and stored in vector embeddings
- Questions are matched against relevant document chunks
- AI generates answers based on retrieved context
- Provides source references for transparency

### Voice Learning
- Real-time speech-to-text using OpenAI Whisper
- Text-to-speech using OpenAI TTS API
- Natural conversation flow with document context
- Displays transcribed speech for clarity

### Learning Analytics
- Tracks document uploads and processing
- Monitors quiz attempts and scores
- Records chat interactions and conversation history
- Provides insights into learning patterns

## 🚨 Troubleshooting

### Common Issues

1. **OpenAI API Key Error**
   - Ensure your API key is correctly set in `.env`
   - Check that you have sufficient API credits

2. **Voice Chat Not Working**
   - Allow microphone permissions in your browser
   - Ensure WebSocket connection is established
   - Check browser console for errors

3. **Documents Not Processing**
   - Verify PDF files are not corrupted
   - Check file size limits (10MB default)
   - Ensure backend server is running

4. **Frontend Not Loading**
   - Check if frontend dev server is running
   - Verify port conflicts (try different ports)
   - Clear browser cache and reload

### Debug Mode

Enable debug logging by checking browser console and backend logs:
- Frontend: Browser Developer Tools → Console
- Backend: Terminal output when running uvicorn

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for providing the AI APIs (GPT, Whisper, TTS)
- LangChain for the RAG framework
- FastAPI for the robust backend framework
- React and shadcn/ui for the modern frontend
- FAISS for efficient vector similarity search

---

**Made with ❤️ for learners everywhere**

Transform your learning experience with AI-powered document analysis and voice interaction. Upload your materials, ask questions, generate summaries, create quizzes, and learn with your voice!