// API Configuration
import { getSessionId } from '@/lib/session';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// ws:// for http:// backends (local dev), wss:// for https://
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: {
    UPLOAD: `${API_BASE_URL}/upload`,
    SUMMARIZE: `${API_BASE_URL}/summarize`,
    ASK: `${API_BASE_URL}/ask`,
    ASK_STREAM: `${API_BASE_URL}/ask/stream`,
    SUMMARIZE_STREAM: `${API_BASE_URL}/summarize/stream`,
    QUIZ: `${API_BASE_URL}/generate-quiz`,
    DOCUMENTS: `${API_BASE_URL}/documents`,
    CURRENT_SESSION_DOCUMENTS: `${API_BASE_URL}/current-session-documents`,
    DELETE_DOCUMENT: (filename: string) => `${API_BASE_URL}/documents/${encodeURIComponent(filename)}`,
    CONVERSATIONS: `${API_BASE_URL}/conversations`,
    CONVERSATION_HISTORY: (id: string) => `${API_BASE_URL}/conversations/${id}/history`,
    USER_CONVERSATIONS: (userId: string) => `${API_BASE_URL}/conversations/user/${userId}`,
    ANALYTICS_USER: (userId: string) => `${API_BASE_URL}/analytics/user/${userId}`,
    ANALYTICS_GLOBAL: `${API_BASE_URL}/analytics/global`,
    ANALYTICS_PERFORMANCE: `${API_BASE_URL}/analytics/performance-metrics`,
    MODEL_PERFORMANCE: `${API_BASE_URL}/analytics/model-performance`,
    TRACK_QUIZ: `${API_BASE_URL}/analytics/track-quiz`,
    FEEDBACK: `${API_BASE_URL}/analytics/feedback`,
    CONFIG: `${API_BASE_URL}/config`,
    SESSION: `${API_BASE_URL}/session`,
    // WebSockets can't carry custom headers, so the session id travels as a query param
    VOICE_WS: (clientId: string) => `${WS_BASE_URL}/voice/ws/${clientId}?session_id=${encodeURIComponent(getSessionId())}`,
    VOICE_STATUS: `${API_BASE_URL}/voice/status`,
    VOICE_CONNECTIONS: `${API_BASE_URL}/voice/connections`,
    VOICE_TEST: `${API_BASE_URL}/voice/test`,
    VOICE_VOICES: `${API_BASE_URL}/voice/voices`,
  }
};

export default API_CONFIG;
