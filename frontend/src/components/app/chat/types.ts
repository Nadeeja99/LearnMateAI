export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  document_context: string[];
  summary?: string;
}

export interface AskResponse {
  answer: string;
  sources?: string[];
  conversation_id: string;
}
