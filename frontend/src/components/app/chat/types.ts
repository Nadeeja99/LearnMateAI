import type { Telemetry } from "@/lib/telemetry";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: string;
  metadata?: Record<string, unknown>;
  telemetry?: Telemetry;
  /** "streaming" while tokens arrive; "stopped" for a partial reply that was cancelled or failed. */
  status?: "streaming" | "stopped";
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
