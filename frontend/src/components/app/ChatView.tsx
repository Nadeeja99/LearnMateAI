import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Copy, ThumbsUp, ThumbsDown, Sparkles, Loader2, MessageSquare, Plus, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: string;
  metadata?: any;
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
      const response = await fetch("http://localhost:8000/conversations/user/default");
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
      const response = await fetch("http://localhost:8000/conversations", {
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
      const response = await fetch(`http://localhost:8000/conversations/${conversationId}/history`);
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
      const sessionResponse = await fetch("http://localhost:8000/current-session-documents");
      const sessionData = await sessionResponse.json();
      
      console.log("Current session documents for question:", sessionData.documents);
      
      const response = await fetch("http://localhost:8000/ask", {
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
    <div className="flex flex-col h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <h2 className="text-2xl sm:text-3xl font-bold">Chat with Your Documents</h2>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversations(!showConversations)}
              className="text-xs sm:text-sm"
            >
              <History className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Conversations</span>
              <span className="sm:hidden">Chats</span>
              ({conversations.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => createNewConversation(true)}
              className="text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">New Chat</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
        
        {currentConversationId && (
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Active conversation: {currentConversationId.split('_').slice(-1)[0]}
            </span>
          </div>
        )}
        
        {documents.length > 0 ? (
          <p className="text-muted-foreground">
            Chatting about: <span className="text-primary font-medium">{documents[documents.length - 1]}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">Upload a document to start chatting</p>
        )}
      </div>

      {/* Conversations Sidebar */}
      {showConversations && (
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Previous Conversations</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConversations(false)}
            >
              ×
            </Button>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    conv.id === currentConversationId
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => loadConversation(conv.id)}
                >
                  <div className="font-medium text-sm truncate">{conv.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {conv.message_count} messages • {new Date(conv.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No previous conversations found
                </p>
              )}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Messages */}
      <Card className="flex-1 mb-4 overflow-hidden">
        <ScrollArea className="h-full p-4 sm:p-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 sm:space-y-8">
              <div className="text-center space-y-3 sm:space-y-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Start a Conversation</h3>
                  <p className="text-muted-foreground text-sm sm:text-base">Ask questions about your documents</p>
                </div>
              </div>

              {documents.length > 0 && (
                <div className="space-y-2 sm:space-y-3 w-full max-w-md">
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">Try these questions:</p>
                  {sampleQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start text-left text-xs sm:text-sm"
                      onClick={() => handleSampleQuestion(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-up`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[80%] rounded-lg p-3 sm:p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                    
                    {message.role === "assistant" && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(message.content)}
                          className="text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start animate-fade-up">
                  <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI is thinking...</span>
                    </div>
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
          placeholder="Ask a question about your documents..."
          className="flex-1 text-sm sm:text-base"
          disabled={isLoading || documents.length === 0}
        />
        <Button 
          onClick={handleSend} 
          disabled={isLoading || !input.trim() || documents.length === 0}
          size="sm"
          className="px-3 sm:px-4"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Press Enter to send • {input.length} characters
      </p>
    </div>
  );
};

export default ChatView;
