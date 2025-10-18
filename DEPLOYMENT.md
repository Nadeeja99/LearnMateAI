# LearnMate AI - Render.com Deployment Guide

This guide will help you deploy LearnMate AI on Render.com with both frontend and backend services.

## Prerequisites

1. **Render.com Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Push your code to GitHub
3. **OpenAI API Key**: Get your API key from [OpenAI Platform](https://platform.openai.com)
4. **LangFuse Account** (Optional): Sign up at [langfuse.com](https://langfuse.com) for observability

## Deployment Steps

### 1. Backend Service Setup

1. **Create New Web Service**:
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Choose the repository containing LearnMate AI

2. **Configure Backend Service**:
   ```
   Name: learnmate-backend
   Environment: Python 3
   Build Command: pip install -r backend/requirements.txt
   Start Command: cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

3. **Environment Variables**:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   LANGFUSE_PUBLIC_KEY=your_langfuse_public_key_here (optional)
   LANGFUSE_SECRET_KEY=your_langfuse_secret_key_here (optional)
   LANGFUSE_HOST=https://cloud.langfuse.com (optional)
   LANGFUSE_ENABLED=true (optional)
   ENVIRONMENT=production
   PYTHON_VERSION=3.11.0
   ```

4. **Disk Storage** (Optional):
   - Add a disk for persistent data storage
   - Mount path: `/opt/render/project/src/backend/data`
   - Size: 1GB

### 2. Frontend Service Setup

1. **Create New Static Site**:
   - Go to Render Dashboard → New → Static Site
   - Connect your GitHub repository

2. **Configure Frontend Service**:
   ```
   Name: learnmate-frontend
   Build Command: cd frontend && npm ci && npm run build
   Publish Directory: frontend/dist
   ```

3. **Environment Variables**:
   ```
   VITE_API_URL=https://learnmate-backend.onrender.com
   ```

4. **Custom Headers** (Optional):
   ```
   /api/*: https://learnmate-backend.onrender.com/$1
   ```

### 3. Alternative: Using render.yaml

Instead of manual setup, you can use the provided `render.yaml` file:

1. **Push render.yaml to your repository**
2. **In Render Dashboard**:
   - Go to Dashboard → New → Blueprint
   - Select your repository
   - Render will automatically create both services

### 4. Post-Deployment Configuration

1. **Update CORS Settings**:
   - After deployment, update the backend CORS origins to include your frontend URL
   - The backend will automatically include production URLs when `ENVIRONMENT=production`

2. **Test the Application**:
   - Visit your frontend URL
   - Upload a document
   - Test chat functionality
   - Verify voice chat works (requires HTTPS)

3. **Custom Domain** (Optional):
   - Add your custom domain in Render dashboard
   - Update CORS origins in backend environment variables

## Environment Variables Reference

### Backend Required Variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `ENVIRONMENT`: Set to "production" for production deployment

### Backend Optional Variables:
- `LANGFUSE_PUBLIC_KEY`: LangFuse public key for observability
- `LANGFUSE_SECRET_KEY`: LangFuse secret key for observability
- `LANGFUSE_HOST`: LangFuse host URL (default: https://cloud.langfuse.com)
- `LANGFUSE_ENABLED`: Enable LangFuse (default: true)

### Frontend Variables:
- `VITE_API_URL`: Backend API URL (e.g., https://learnmate-backend.onrender.com)

## Important Notes

1. **Free Tier Limitations**:
   - Services sleep after 15 minutes of inactivity
   - Cold start may take 30-60 seconds
   - Consider upgrading to paid plans for production use

2. **HTTPS Requirements**:
   - Voice chat requires HTTPS
   - Render provides HTTPS by default

3. **File Storage**:
   - Documents are stored in memory on free tier
   - Consider adding persistent disk storage for production

4. **WebSocket Support**:
   - Render supports WebSockets
   - Voice chat should work on production

## Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - Ensure frontend URL is added to backend CORS origins
   - Check environment variables are set correctly

2. **API Connection Issues**:
   - Verify `VITE_API_URL` is set correctly in frontend
   - Check backend service is running and healthy

3. **Voice Chat Not Working**:
   - Ensure you're using HTTPS
   - Check browser permissions for microphone access
   - Verify WebSocket connection in browser dev tools

4. **Build Failures**:
   - Check build logs in Render dashboard
   - Ensure all dependencies are in requirements.txt
   - Verify Python version compatibility

### Health Check:
- Backend health endpoint: `https://your-backend-url.onrender.com/health`
- Should return: `{"status": "healthy", "timestamp": "..."}`

## Monitoring and Logs

1. **View Logs**:
   - Go to your service in Render dashboard
   - Click on "Logs" tab

2. **Monitor Performance**:
   - Use LangFuse dashboard for AI interactions
   - Check Render metrics for service performance

## Security Considerations

1. **API Keys**:
   - Never commit API keys to repository
   - Use Render environment variables
   - Rotate keys regularly

2. **CORS**:
   - Only allow necessary origins
   - Update origins when changing domains

3. **Rate Limiting**:
   - Consider implementing rate limiting for production
   - Monitor OpenAI API usage

## Support

For issues specific to:
- **Render.com**: Check Render documentation and support
- **OpenAI API**: Check OpenAI platform documentation
- **LearnMate AI**: Check application logs and this deployment guide
