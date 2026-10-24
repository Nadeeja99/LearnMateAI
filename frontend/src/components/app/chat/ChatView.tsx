import { useState, useRef, useEffect } from "react";
import { History, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAbortController } from "@/hooks/use-abort-controller";
import { useConversations } from "@/hooks/use-conversations";
import API_CONFIG from "@/lib/api";
import { errorText, isAbortError, requestJson } from "@/lib/http";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";
import { ChatMessage, MessageListSkeleton, TypingIndicator } from "./ChatMessage";
import ChatComposer from "./ChatComposer";
import ConversationHistory from "./ConversationHistory";
import type { AskResponse, Message } from "./types";

const SAMPLE_QUESTIONS = [
  "What are the main topics covered?",
  "Explain [concept] in simple terms",
  "What are the key takeaways?",
  "Give me examples of [topic]",
];

interface ChatViewProps {
  documents: string[];
}

interface Failure {
  question: string;
  message: string;
  aborted: boolean;
}

const ChatView = ({ documents }: ChatViewProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const history = useConversations();
  const request = useAbortController();
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const hasDocuments = documents.length > 0;

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, isLoading, failure]);

  /** Creates a conversation and returns its id, or null on failure. */
  const createNewConversation = async (announce: boolean): Promise<string | null> => {
    try {
      const data = await requestJson<{ conversation_id: string }>(API_CONFIG.ENDPOINTS.CONVERSATIONS, {
        method: "POST",
        json: { user_id: "default", title: `Chat ${new Date().toLocaleString()}`, document_context: documents },
      });
      setCurrentConversationId(data.conversation_id);
      setMessages([]);
      setFailure(null);
      history.reload();
      if (announce) {
        toast({ title: "New conversation started", description: "You can now ask questions with full conversation context" });
        composerRef.current?.focus();
      }
      return data.conversation_id;
    } catch (error) {
      toast({ title: "Couldn't start a conversation", description: errorText(error), variant: "destructive" });
      return null;
    }
  };

  const loadConversation = async (conversationId: string) => {
    setShowConversations(false);
    setFailure(null);
    setIsLoadingConversation(true);
    try {
      const data = await requestJson<{ history?: Message[] }>(API_CONFIG.ENDPOINTS.CONVERSATION_HISTORY(conversationId));
      setCurrentConversationId(conversationId);
      setMessages(data.history || []);
    } catch (error) {
      toast({ title: "Couldn't load conversation", description: errorText(error), variant: "destructive" });
    } finally {
      setIsLoadingConversation(false);
    }
  };

  /** Sends a question. Retries reuse the user message already in the list. */
  const ask = async (question: string, isRetry = false) => {
    if (!question.trim() || isLoading) return;
    if (!hasDocuments) {
      toast({ title: "No documents uploaded", description: "Please upload a document first to start chatting", variant: "destructive" });
      return;
    }

    setFailure(null);
    const conversationId = currentConversationId ?? (await createNewConversation(false));
    if (!conversationId) return;

    if (!isRetry) {
      setMessages((prev) => [...prev, { id: `msg_${Date.now()}`, role: "user", content: question, timestamp: new Date().toISOString() }]);
      setInput("");
    }

    setIsLoading(true);
    try {
      const data = await requestJson<AskResponse>(API_CONFIG.ENDPOINTS.ASK, {
        method: "POST",
        signal: request.begin(),
        json: { question, user_id: "default", conversation_id: conversationId },
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
          timestamp: new Date().toISOString(),
          metadata: { conversation_id: data.conversation_id },
        },
      ]);
      history.reload();
    } catch (error) {
      const aborted = isAbortError(error);
      setFailure({ question, aborted, message: aborted ? "" : errorText(error, "Failed to get a response.") });
    } finally {
      setIsLoading(false);
      composerRef.current?.focus();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied!", description: "Message copied to clipboard" });
  };

  const handleSampleQuestion = (question: string) => {
    setInput(question);
    composerRef.current?.focus();
  };

  return (
    <div className="flex h-view flex-col">
      <PageHeader
        title="Chat with your documents"
        description={
          hasDocuments ? (
            <>
              Chatting about <span className="font-medium text-foreground">{documents[documents.length - 1]}</span>
              {currentConversationId && (
                <span className="ml-2 text-muted-foreground">· Conversation {currentConversationId.split("_").slice(-1)[0]}</span>
              )}
            </>
          ) : (
            "Upload a document to start chatting"
          )
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowConversations(!showConversations)} aria-expanded={showConversations}>
              <History />
              History
              <span className="text-muted-foreground">{history.isLoading ? "…" : history.conversations.length}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => createNewConversation(true)}>
              <Plus />
              New chat
            </Button>
          </>
        }
      />

      {showConversations && (
        <ConversationHistory
          conversations={history.conversations}
          isLoading={history.isLoading}
          error={history.error}
          currentId={currentConversationId}
          onSelect={loadConversation}
          onRetry={history.reload}
          onClose={() => setShowConversations(false)}
        />
      )}

      <Card className="mb-4 flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          {isLoadingConversation ? (
            <MessageListSkeleton />
          ) : messages.length === 0 && !failure ? (
            <EmptyState
              icon={Sparkles}
              tone="primary"
              title={hasDocuments ? "Start a conversation" : "No documents yet"}
              description={hasDocuments ? "Ask anything about your documents, or try a suggestion." : "Upload a PDF from the sidebar, then ask questions about it here."}
            >
              {hasDocuments && (
                <div className="mx-auto grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {SAMPLE_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      className="rounded-lg border bg-background px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => handleSampleQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </EmptyState>
          ) : (
            <div className="space-y-6 p-4 sm:p-6">
              {messages.map((message, index) => (
                <ChatMessage key={message.id ?? index} message={message} onCopy={handleCopy} />
              ))}
              {isLoading && <TypingIndicator />}
              {failure && (
                <InlineError
                  tone={failure.aborted ? "muted" : "error"}
                  title={failure.aborted ? "Response stopped" : "Couldn't get a response"}
                  message={failure.message || undefined}
                  onRetry={() => ask(failure.question, true)}
                  retryLabel={failure.aborted ? "Ask again" : "Retry"}
                />
              )}
            </div>
          )}
        </ScrollArea>
      </Card>

      <ChatComposer
        ref={composerRef}
        value={input}
        onChange={setInput}
        onSubmit={() => ask(input)}
        onStop={request.abort}
        isBusy={isLoading}
        disabled={!hasDocuments}
      />
    </div>
  );
};

export default ChatView;
