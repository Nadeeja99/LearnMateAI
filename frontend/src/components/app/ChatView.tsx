import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Copy, ThumbsUp, ThumbsDown, Sparkles, Loader2, Plus, History, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import PageHeader from "@/components/app/PageHeader";
import IconBadge from "@/components/app/IconBadge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Conversation {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  document_context: string[];
  summary?: string;
}

interface ChatViewProps {
  documents: string[];
}

const ChatView = ({ documents }: ChatViewProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const sampleQuestions = [
    "What are the main topics covered?",
    "Explain [concept] in simple terms",
    "What are the key takeaways?",
    "Give me examples of [topic]",
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load conversations on component mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch(API_CONFIG.ENDPOINTS.USER_CONVERSATIONS("default"));
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const createNewConversation = async (showToast: boolean = true) => {
    try {
      const response = await fetch(API_CONFIG.ENDPOINTS.CONVERSATIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "default",
          title: `Chat ${new Date().toLocaleString()}`,
          document_context: documents
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentConversationId(data.conversation_id);
        setMessages([]);
        loadConversations();
        
        if (showToast) {
          toast({
            title: "New conversation started",
            description: "You can now ask questions with full conversation context"
          });
        }
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(API_CONFIG.ENDPOINTS.CONVERSATION_HISTORY(conversationId));
      if (response.ok) {
        const data = await response.json();
        setCurrentConversationId(conversationId);
        setMessages(data.history || []);
        setShowConversations(false);
        toast({
          title: "Conversation loaded",
          description: `Loaded ${data.history.length} messages`
        });
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (documents.length === 0) {
      toast({
        title: "No documents uploaded",
        description: "Please upload a document first to start chatting",
        variant: "destructive",
      });
      return;
    }

    // Create conversation if none exists (without showing toast)
    if (!currentConversationId) {
      await createNewConversation(false); // Don't show toast for automatic conversation creation
      if (!currentConversationId) return; // Wait for conversation to be created
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Get current session documents from backend
      const sessionResponse = await fetch(API_CONFIG.ENDPOINTS.CURRENT_SESSION_DOCUMENTS);
      const sessionData = await sessionResponse.json();
      
      console.log("Current session documents for question:", sessionData.documents);
      
      const response = await fetch(API_CONFIG.ENDPOINTS.ASK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: input,
          session_documents: sessionData.documents,
          user_id: "default",
          conversation_id: currentConversationId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
          timestamp: new Date().toISOString(),
          metadata: { conversation_id: data.conversation_id }
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Refresh conversations to show updated message count
        loadConversations();
      } else {
        throw new Error("Failed to get response");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard",
    });
  };

  const handleSampleQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <div className="flex h-view flex-col">
      <PageHeader
        title="Chat with your documents"
        description={
          documents.length > 0 ? (
            <>
              Chatting about <span className="font-medium text-foreground">{documents[documents.length - 1]}</span>
              {currentConversationId && (
                <span className="ml-2 text-muted-foreground">· Conversation {currentConversationId.split('_').slice(-1)[0]}</span>
              )}
            </>
          ) : (
            "Upload a document to start chatting"
          )
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowConversations(!showConversations)}>
              <History />
              History
              <span className="text-muted-foreground">{conversations.length}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => createNewConversation(true)}>
              <Plus />
              New chat
            </Button>
          </>
        }
      />

      {/* Conversations */}
      {showConversations && (
        <Card className="mb-4 p-4 animate-fade-up">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Previous conversations</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowConversations(false)} aria-label="Close history">
              <X />
            </Button>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-1 pr-3">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                    conv.id === currentConversationId ? "bg-accent" : "hover:bg-accent/60"
                  }`}
                  onClick={() => loadConversation(conv.id)}
                >
                  <div className="truncate text-sm font-medium">{conv.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {conv.message_count} messages · {new Date(conv.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No previous conversations found</p>
              )}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Messages */}
      <Card className="mb-4 flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-12">
              <div className="space-y-3 text-center">
                <IconBadge icon={Sparkles} size="lg" tone="primary" className="mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground">Ask questions about your documents</p>
                </div>
              </div>

              {documents.length > 0 && (
                <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {sampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      className="rounded-lg border bg-background px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                      onClick={() => handleSampleQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 p-4 sm:p-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-up`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[80%] ${
                      message.role === "user"
                        ? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground"
                        : "rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.content}</p>
                    <div className={`mt-1.5 text-xs ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>

                    {message.role === "assistant" && (
                      <div className="-mb-1 mt-2 flex items-center gap-0.5 border-t pt-2 text-muted-foreground">
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(message.content)} className="h-7 px-2 text-xs">
                          <Copy className="!h-3.5 !w-3.5" />
                          Copy
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Helpful">
                          <ThumbsUp className="!h-3.5 !w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Not helpful">
                          <ThumbsDown className="!h-3.5 !w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start animate-fade-up">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask a question about your documents…"
          className="h-11 flex-1"
          disabled={isLoading || documents.length === 0}
        />
        <Button
          onClick={handleSend}
          disabled={isLoading || !input.trim() || documents.length === 0}
          size="icon"
          className="h-11 w-11"
          aria-label="Send message"
        >
          <Send />
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Press Enter to send · {input.length} characters
      </p>
    </div>
  );
};

export default ChatView;
