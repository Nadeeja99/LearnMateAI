import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import API_CONFIG from "@/lib/api";
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
import { useToast } from "@/hooks/use-toast";

interface VoiceMessage {
  id: string;
  type: "user" | "assistant" | "system";
  text: string;
  audio?: string;
  timestamp: string;
  isPlaying?: boolean;
}

/** Server -> client WebSocket message (see backend voice_agent.py) */
interface VoiceServerMessage {
  type: "welcome" | "response" | "transcribed" | "error" | "pong";
  text: string;
  audio?: string | null;
  timestamp?: string;
}

interface VoiceChatProps {
  documents: string[];
}

const VoiceChat = ({ documents }: VoiceChatProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Generate unique client ID
  useEffect(() => {
    setClientId(`voice_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const connectToVoiceAgent = async () => {
    if (isConnected) return;
    
    setIsConnecting(true);
    try {
      const wsUrl = API_CONFIG.ENDPOINTS.VOICE_WS(clientId);
      websocketRef.current = new WebSocket(wsUrl);
      
      websocketRef.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        toast({
          title: "Connected to Voice Agent",
          description: "You can now start speaking to analyze your documents",
        });
      };
      
      websocketRef.current.onmessage = (event) => {
        const message: VoiceServerMessage = JSON.parse(event.data);
        handleVoiceMessage(message);
      };
      
      websocketRef.current.onclose = () => {
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
        toast({
          title: "Disconnected from Voice Agent",
          description: "Voice chat session ended",
          variant: "destructive",
        });
      };
      
      websocketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice agent",
          variant: "destructive",
        });
      };
      
    } catch (error) {
      console.error("Error connecting to voice agent:", error);
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: "Failed to connect to voice agent",
        variant: "destructive",
      });
    }
  };

  const disconnectFromVoiceAgent = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  };

  const handleVoiceMessage = (message: VoiceServerMessage) => {
    
    if (message.type === "transcribed") {
      // Update the last user message with the actual transcribed text
      setMessages(prev => {
        const updated = prev.map((msg, index) => {
          if (index === prev.length - 1 && (msg.text === "🎤 Listening..." || msg.text === "🎤 Processing...") && msg.type === "user") {
            return { ...msg, text: message.text };
          }
          return msg;
        });
        return updated;
      });
      return;
    }
    
    const voiceMessage: VoiceMessage = {
      id: `msg_${Date.now()}`,
      type: message.type === "welcome" || message.type === "response" ? "assistant" : "system",
      text: message.text,
      audio: message.audio,
      timestamp: message.timestamp || new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, voiceMessage]);
    
    // Play audio response if available
    if (message.audio && message.type === "response") {
      playAudio(message.audio);
    }
  };


  const startListening = async () => {
    if (!isConnected) {
      await connectToVoiceAgent();
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        sendAudioToAgent(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsListening(true);
      
      // Add user message placeholder
      const userMessage: VoiceMessage = {
        id: `user_${Date.now()}`,
        type: "user",
        text: "🎤 Listening...",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use voice chat",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      
      // Update the last user message that's currently listening
      setMessages(prev => 
        prev.map((msg, index) => 
          index === prev.length - 1 && msg.text === "🎤 Listening..." && msg.type === "user"
            ? { ...msg, text: "🎤 Processing..." }
            : msg
        )
      );
    }
  };

  const sendAudioToAgent = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        if (base64Audio && websocketRef.current) {
          websocketRef.current.send(JSON.stringify({
            type: "voice",
            audio: base64Audio,
            timestamp: new Date().toISOString()
          }));
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("Error sending audio:", error);
    }
  };


  const playAudio = async (base64Audio: string) => {
    try {
      setIsSpeaking(true);
      
      if (base64Audio) {
        // Decode and play the actual audio from the server
        const audioBytes = atob(base64Audio);
        const audioArray = new Uint8Array(audioBytes.length);
        for (let i = 0; i < audioBytes.length; i++) {
          audioArray[i] = audioBytes.charCodeAt(i);
        }
        
        const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        // Fallback to browser speech synthesis
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = messages[messages.length - 1]?.text || "Response received";
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        speechSynthesis.speak(utterance);
      }
      
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsSpeaking(false);
      
      // Fallback to browser speech synthesis
      try {
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = messages[messages.length - 1]?.text || "Response received";
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        speechSynthesis.speak(utterance);
      } catch (fallbackError) {
        console.error("Fallback audio also failed:", fallbackError);
        setIsSpeaking(false);
      }
    }
  };


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
              <Button variant="outline" size="sm" onClick={disconnectFromVoiceAgent}>
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
            <Button onClick={connectToVoiceAgent} disabled={isConnecting} size="lg" className="w-full sm:w-auto">
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
                onClick={() => setIsSpeaking(false)}
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
