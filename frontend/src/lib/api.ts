// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: {
    UPLOAD: `${API_BASE_URL}/upload`,
    SUMMARIZE: `${API_BASE_URL}/summarize`,
    ASK: `${API_BASE_URL}/ask`,
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
    TRACK_QUIZ: `${API_BASE_URL}/analytics/track-quiz`,
    VOICE_WS: (clientId: string) => `wss://${API_BASE_URL.replace('http://', '').replace('https://', '')}/voice/ws/${clientId}`,
    VOICE_STATUS: `${API_BASE_URL}/voice/status`,
    VOICE_CONNECTIONS: `${API_BASE_URL}/voice/connections`,
    VOICE_TEST: `${API_BASE_URL}/voice/test`,
    VOICE_VOICES: `${API_BASE_URL}/voice/voices`,
  }
};

export default API_CONFIG;
