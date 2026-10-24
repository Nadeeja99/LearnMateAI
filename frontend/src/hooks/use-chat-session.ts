import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAbortController } from "@/hooks/use-abort-controller";
import { useConversations } from "@/hooks/use-conversations";
import API_CONFIG from "@/lib/api";
import { errorText, isAbortError, requestJson } from "@/lib/http";
import { frameBatched, streamCompletion } from "@/lib/stream";
import { parseTelemetry } from "@/lib/telemetry";
import type { Message } from "@/components/app/chat/types";

/** Drops partial replies left after the last user message, before asking again. */
const withoutPartialReplies = (messages: Message[]) => {
  const result = [...messages];
  while (result.length && result[result.length - 1].status === "stopped") result.pop();
  return result;
};

export interface Failure {
  question: string;
  message: string;
  aborted: boolean;
}

interface ChatSessionOptions {
  /** Called when the composer should regain focus (after a reply settles or a new chat starts). */
  onSettled?: () => void;
}

/** Conversation state for the chat view: create/load conversations and stream answers. */
export function useChatSession(documents: string[], { onSettled }: ChatSessionOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const history = useConversations();
  const request = useAbortController();
  const { toast } = useToast();
  const hasDocuments = documents.length > 0;

  /** Creates a conversation and returns its id, or null on failure. */
  const createNewConversation = async (announce: boolean): Promise<string | null> => {
    try {
      const data = await requestJson<{ conversation_id: string }>(API_CONFIG.ENDPOINTS.CONVERSATIONS, {
        method: "POST",
        json: { title: `Chat ${new Date().toLocaleString()}`, document_context: documents },
      });
      setCurrentConversationId(data.conversation_id);
      setMessages([]);
      setFailure(null);
      history.reload();
      if (announce) {
        toast({ title: "New conversation started", description: "You can now ask questions with full conversation context" });
        onSettled?.();
      }
      return data.conversation_id;
    } catch (error) {
      toast({ title: "Couldn't start a conversation", description: errorText(error), variant: "destructive" });
      return null;
    }
  };

  const loadConversation = async (conversationId: string) => {
    setFailure(null);
    setIsLoadingConversation(true);
    try {
      const data = await requestJson<{ history?: Message[] }>(API_CONFIG.ENDPOINTS.CONVERSATION_HISTORY(conversationId));
      setCurrentConversationId(conversationId);
      setMessages((data.history || []).map((message) => ({ ...message, telemetry: parseTelemetry(message.metadata?.telemetry) })));
    } catch (error) {
      toast({ title: "Couldn't load conversation", description: errorText(error), variant: "destructive" });
    } finally {
      setIsLoadingConversation(false);
    }
  };

  /**
   * Streams an answer. Retries reuse the user message already in the list;
   * onAccepted fires once the question is committed (e.g. to clear the input).
   */
  const ask = async (question: string, { isRetry = false, onAccepted }: { isRetry?: boolean; onAccepted?: () => void } = {}) => {
    if (!question.trim() || isLoading) return;
    if (!hasDocuments) {
      toast({ title: "No documents uploaded", description: "Please upload a document first to start chatting", variant: "destructive" });
      return;
    }

    setFailure(null);
    const conversationId = currentConversationId ?? (await createNewConversation(false));
    if (!conversationId) return;

    const assistantId = `msg_${Date.now()}_assistant`;
    const now = new Date().toISOString();
    const userMessage: Message = { id: `msg_${Date.now()}`, role: "user", content: question, timestamp: now };
    const placeholder: Message = { id: assistantId, role: "assistant", content: "", timestamp: now, status: "streaming" };
    setMessages((prev) => [...(isRetry ? withoutPartialReplies(prev) : [...prev, userMessage]), placeholder]);
    onAccepted?.();

    const updateReply = (patch: Partial<Message>) =>
      setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, ...patch } : message)));
    const renderText = frameBatched((content: string) => updateReply({ content }));

    setIsLoading(true);
    try {
      const result = await streamCompletion(
        API_CONFIG.ENDPOINTS.ASK_STREAM,
        { question, conversation_id: conversationId },
        { signal: request.begin(), onText: renderText },
      );
      renderText.flush();
      updateReply({
        content: result.text,
        status: undefined,
        telemetry: result.telemetry,
        sources: [...new Set(result.telemetry?.sources.map((chunk) => chunk.source))],
        timestamp: new Date().toISOString(),
      });
      history.reload();
    } catch (error) {
      renderText.flush();
      // Keep partial text from a cancelled or failed reply; drop an empty placeholder
      setMessages((prev) =>
        prev.flatMap((message) => (message.id !== assistantId ? [message] : message.content ? [{ ...message, status: "stopped" as const }] : [])),
      );
      const aborted = isAbortError(error);
      setFailure({ question, aborted, message: aborted ? "" : errorText(error, "Failed to get a response.") });
    } finally {
      setIsLoading(false);
      onSettled?.();
    }
  };

  return {
    messages,
    isLoading,
    isLoadingConversation,
    currentConversationId,
    failure,
    history,
    createNewConversation,
    loadConversation,
    ask,
    stop: request.abort,
  };
}
