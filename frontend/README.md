# LearnMate AI Frontend 🎨

A modern React-based frontend for the LearnMate AI Personal Learning Assistant application. This frontend provides an intuitive and responsive user interface for document upload, AI-powered chat, voice interaction, and learning analytics.

## ✨ Features

### 📄 **Document Management**
- Drag and drop PDF upload interface
- Real-time upload progress tracking
- Document list with delete functionality
- Session-based document management

### 🤖 **AI-Powered Chat Interface**
- Natural language chat with uploaded documents
- Conversation history and context management
- Multiple conversation support
- Real-time message streaming

### 🎤 **Voice Learning Assistant**
- Real-time voice chat with document context
- Speech-to-text transcription display
- Voice response playback
- Natural conversation flow
- WebSocket-based real-time communication

### 📝 **Smart Summarization**
- One-click document summarization
- Clean, readable summary display
- Source document integration

### 🧠 **Interactive Quiz Generation**
- Dynamic quiz creation from documents
- Multiple choice questions with explanations
- Real-time scoring and feedback
- Progress tracking

### 📊 **Learning Analytics Dashboard**
- User learning progress visualization
- Quiz performance tracking
- Chat interaction analytics
- Global learning insights

### 💬 **Conversation Management**
- Multiple conversation support
- Conversation history sidebar
- Context-aware chat sessions
- Persistent conversation storage

## 🛠️ Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui components
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **State Management**: React Hooks
- **HTTP Client**: Fetch API
- **Real-time Communication**: WebSocket API

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Backend server running (see backend README)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LearnMateAI/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:8080` (or the port shown in terminal)

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── app/                   # Main application components
│   │   │   ├── UploadSection.tsx  # Document upload interface
│   │   │   ├── ChatView.tsx       # Chat interface
│   │   │   ├── VoiceChat.tsx      # Voice chat interface
│   │   │   ├── SummaryView.tsx    # Document summarization
│   │   │   ├── QuizView.tsx       # Quiz generation and taking
│   │   │   ├── DocumentsView.tsx  # Document management
│   │   │   └── AnalyticsDashboard.tsx # Learning analytics
│   │   └── ui/                    # Reusable UI components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── ... (shadcn/ui components)
│   ├── pages/
│   │   ├── App.tsx                # Main application page
│   │   ├── Landing.tsx            # Landing page
│   │   ├── Index.tsx              # Home page
│   │   └── NotFound.tsx           # 404 page
│   ├── hooks/
│   │   ├── use-toast.ts           # Toast notifications
│   │   └── use-mobile.tsx         # Mobile detection
│   ├── lib/
│   │   └── utils.ts               # Utility functions
│   ├── index.css                  # Global styles
│   └── main.tsx                   # Application entry point
├── public/
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## 🎯 Component Overview

### UploadSection.tsx
- Handles PDF file uploads
- Drag and drop interface
- Upload progress tracking
- File validation

### ChatView.tsx
- Chat interface with message history
- Conversation management
- Real-time message updates
- Context-aware responses

### VoiceChat.tsx
- Real-time voice interaction
- WebSocket connection management
- Speech transcription display
- Audio playback controls

### SummaryView.tsx
- Document summarization interface
- Clean summary display
- Source document integration

### QuizView.tsx
- Quiz generation and taking
- Multiple choice questions
- Real-time scoring
- Progress tracking

### DocumentsView.tsx
- Document list management
- Delete functionality
- Session document tracking

### AnalyticsDashboard.tsx
- Learning progress visualization
- Performance metrics
- User and global analytics

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```env
# Backend API URL
VITE_API_URL=http://localhost:8000

# WebSocket URL for voice chat
VITE_WS_URL=ws://localhost:8000

# Application settings
VITE_APP_NAME=LearnMate AI
VITE_APP_VERSION=1.0.0
```

### Vite Configuration

The project uses Vite with the following configuration:
- React with TypeScript
- Tailwind CSS integration
- Auto-reload development server
- Optimized production builds

## 🎨 UI Components

### Design System

The application uses shadcn/ui components with Tailwind CSS:

- **Colors**: Primary, secondary, accent color scheme
- **Typography**: Inter font family
- **Spacing**: Consistent spacing scale
- **Components**: Button, Card, Input, Dialog, etc.

### Responsive Design

- Mobile-first approach
- Responsive breakpoints
- Touch-friendly interfaces
- Adaptive layouts

## 🔌 API Integration

### REST API Calls

```typescript
// Example API call
const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
};
```

### WebSocket Integration

```typescript
// Voice chat WebSocket connection
const connectToVoiceAgent = async () => {
  const wsUrl = `ws://localhost:8000/voice/ws/${clientId}`;
  const websocket = new WebSocket(wsUrl);
  
  websocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleVoiceMessage(message);
  };
};
```

## 🎤 Voice Chat Features

### Real-time Voice Interaction
- WebSocket-based communication
- Speech-to-text transcription
- Text-to-speech responses
- Natural conversation flow

### Audio Processing
- MediaRecorder API for audio capture
- Base64 audio encoding/decoding
- Audio playback controls
- Microphone permissions handling

### Voice Controls
- Start/stop listening buttons
- Audio playback controls
- Connection status indicators
- Error handling and fallbacks

## 📱 Responsive Design

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile Features
- Touch-friendly interfaces
- Swipe gestures
- Optimized layouts
- Mobile-specific components

## 🚨 Troubleshooting

### Common Issues

1. **Backend Connection Error**
   - Ensure backend server is running
   - Check API URL configuration
   - Verify CORS settings

2. **Voice Chat Not Working**
   - Allow microphone permissions
   - Check WebSocket connection
   - Verify browser compatibility

3. **File Upload Issues**
   - Check file size limits
   - Verify file type (PDF only)
   - Ensure network connectivity

4. **Build Errors**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify TypeScript configuration

### Debug Mode

Enable debug logging:
```typescript
// In development mode
console.log('Debug info:', data);
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🚀 Build and Deployment

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Deployment Options

1. **Static Hosting**
   - Netlify
   - Vercel
   - GitHub Pages

2. **CDN Deployment**
   - AWS CloudFront
   - Cloudflare

3. **Container Deployment**
   - Docker
   - Kubernetes

## 📊 Performance Optimization

### Code Splitting
- Lazy loading of components
- Route-based code splitting
- Dynamic imports

### Bundle Optimization
- Tree shaking
- Minification
- Compression

### Caching
- Service worker implementation
- Browser caching strategies
- API response caching

## 🔒 Security Considerations

- ✅ Input validation
- ✅ XSS prevention
- ✅ CSRF protection
- ✅ Secure API communication
- ✅ File upload validation
- ✅ WebSocket security

## 📈 Analytics and Monitoring

### User Analytics
- Learning progress tracking
- Feature usage metrics
- Performance monitoring
- Error tracking

### Performance Metrics
- Page load times
- API response times
- WebSocket connection stability
- User interaction patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- React team for the amazing framework
- shadcn/ui for the beautiful component library
- Tailwind CSS for the utility-first styling
- Vite for the fast build tool
- Lucide React for the icon library

---

**Made with ❤️ for learners everywhere**

A modern, responsive frontend that provides an intuitive interface for AI-powered learning and document analysis.