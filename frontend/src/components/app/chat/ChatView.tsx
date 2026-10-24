import { useState, useRef, useEffect } from "react";
import { History, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatSession } from "@/hooks/use-chat-session";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";
import { ChatMessage, MessageListSkeleton, TypingIndicator } from "./ChatMessage";
import ChatComposer from "./ChatComposer";
import ConversationHistory from "./ConversationHistory";

const SAMPLE_QUESTIONS = [
  "What are the main topics covered?",
  "Explain [concept] in simple terms",
  "What are the key takeaways?",
  "Give me examples of [topic]",
];

interface ChatViewProps {
  documents: string[];
}

const ChatView = ({ documents }: ChatViewProps) => {
  const [input, setInput] = useState("");
  const [showConversations, setShowConversations] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const hasDocuments = documents.length > 0;
  const { messages, isLoading, isLoadingConversation, currentConversationId, failure, history, createNewConversation, loadConversation, ask, stop } =
    useChatSession(documents, { onSettled: () => composerRef.current?.focus() });

  const currentTitle = history.conversations.find((conv) => conv.id === currentConversationId)?.title;

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, failure]);

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
              {currentTitle && <span className="ml-2 text-muted-foreground">· {currentTitle}</span>}
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
          onSelect={(id) => {
            setShowConversations(false);
            loadConversation(id);
          }}
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
              {messages.map((message, index) =>
                message.status === "streaming" && !message.content ? (
                  <TypingIndicator key={message.id} />
                ) : (
                  <ChatMessage key={message.id ?? index} message={message} />
                ),
              )}
              {failure && (
                <InlineError
                  tone={failure.aborted ? "muted" : "error"}
                  title={failure.aborted ? "Response stopped" : "Couldn't get a response"}
                  message={failure.message || undefined}
                  onRetry={() => ask(failure.question, { isRetry: true })}
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
        onSubmit={() => ask(input, { onAccepted: () => setInput("") })}
        onStop={stop}
        isBusy={isLoading}
        disabled={!hasDocuments}
      />
    </div>
  );
};

export default ChatView;
