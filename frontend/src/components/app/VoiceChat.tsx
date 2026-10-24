import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import { 
  Mic, 
  MicOff, 
  VolumeX, 
  Phone, 
  PhoneOff,
  MessageSquare,
  Loader2,
  Pause
} from "lucide-react";
import { useVoiceAgent } from "@/hooks/use-voice-agent";

interface VoiceChatProps {
  documents: string[];
}

const VoiceChat = ({ documents }: VoiceChatProps) => {
  const { isConnected, isConnecting, isListening, isSpeaking, messages, connect, disconnect, startListening, stopListening, stopSpeaking } =
    useVoiceAgent();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const statusText = isListening
    ? "Listening… speak now"
    : isSpeaking
    ? "Playing response…"
    : isConnected
    ? "Ready to listen"
    : "Connect to start voice chat";

  return (
    <div className="flex h-view flex-col">
      <PageHeader
        title="Voice assistant"
        description={
          documents.length > 0 ? (
            <>
              Talking about <span className="font-medium text-foreground">{documents[documents.length - 1]}</span>
            </>
          ) : (
            "Upload a document to start voice chat"
          )
        }
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-success" : "bg-muted-foreground/50"}`} />
              {isConnected ? "Connected" : "Disconnected"}
            </span>
            {isConnected && (
              <Button variant="outline" size="sm" onClick={disconnect}>
                <PhoneOff />
                Disconnect
              </Button>
            )}
          </>
        }
      />

      {/* Voice Controls */}
      <Card className="mb-4 p-6">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {!isConnected ? (
            <Button onClick={connect} disabled={isConnecting} size="lg" className="w-full sm:w-auto">
              {isConnecting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Phone />
                  Connect to voice agent
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={isListening ? stopListening : startListening}
                disabled={isSpeaking}
                variant={isListening ? "destructive" : "default"}
                size="lg"
                className="w-full sm:w-auto"
              >
                {isListening ? (
                  <>
                    <MicOff />
                    Stop listening
                  </>
                ) : (
                  <>
                    <Mic />
                    Start speaking
                  </>
                )}
              </Button>

              <Button
                onClick={stopSpeaking}
                disabled={!isSpeaking}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                {isSpeaking ? (
                  <>
                    <Pause />
                    Stop speaking
                  </>
                ) : (
                  <>
                    <VolumeX />
                    Muted
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {(isListening || isSpeaking) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          {statusText}
        </p>
      </Card>

      {/* Messages */}
      <Card className="mb-4 flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              tone="primary"
              title={isConnected ? "Ready when you are" : "Start a voice chat"}
              description={
                isConnected
                  ? "Press Start speaking and ask a question about your documents."
                  : "Connect to the voice agent and start speaking to analyze your documents."
              }
            />
          ) : (
            <div className="space-y-4 p-4 sm:p-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"} animate-fade-up`}>
                  <div
                    className={`max-w-[85%] px-4 py-2.5 ${
                      message.type === "user"
                        ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                        : message.type === "system"
                        ? "rounded-lg border border-dashed text-sm text-muted-foreground"
                        : "rounded-2xl rounded-bl-md border bg-muted/40"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.text}</p>
                    <div className={`mt-1.5 text-xs ${message.type === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Suggested prompts */}
      {isConnected && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Try saying:</span>
          {["What are the main topics?", "Explain this concept", "Give me a summary", "Create a quiz"].map((text) => (
            <span key={text} className="rounded-full border px-3 py-1">
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
