import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Phone, 
  PhoneOff,
  MessageSquare,
  Loader2,
  Play,
  Pause,
  Settings
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
      const wsUrl = `ws://localhost:8000/voice/ws/${clientId}`;
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
        const message = JSON.parse(event.data);
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

  const handleVoiceMessage = (message: any) => {
    
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


  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <h2 className="text-2xl sm:text-3xl font-bold">Voice Learning Assistant</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`px-3 py-1 rounded-full text-sm ${
              isConnected 
                ? "bg-green-100 text-green-800 border border-green-200" 
                : "bg-gray-100 text-gray-800 border border-gray-200"
            }`}>
              {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
            </div>
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectFromVoiceAgent}
                className="text-xs sm:text-sm"
              >
                <PhoneOff className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            )}
          </div>
        </div>
        
        {documents.length > 0 ? (
          <p className="text-muted-foreground">
            Voice chatting about: <span className="text-primary font-medium">{documents[documents.length - 1]}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">Upload a document to start voice chat</p>
        )}
      </div>

      {/* Voice Controls */}
      <Card className="p-4 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          {!isConnected ? (
            <Button
              onClick={connectToVoiceAgent}
              disabled={isConnecting}
              size="lg"
              className="px-6 sm:px-8 w-full sm:w-auto"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Connecting...</span>
                  <span className="sm:hidden">Connecting</span>
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Connect to Voice Agent</span>
                  <span className="sm:hidden">Connect</span>
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
                className="px-6 sm:px-8 w-full sm:w-auto"
              >
                {isListening ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2" />
                    <span className="hidden sm:inline">Stop Listening</span>
                    <span className="sm:hidden">Stop</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    <span className="hidden sm:inline">Start Speaking</span>
                    <span className="sm:hidden">Speak</span>
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => setIsSpeaking(false)}
                disabled={!isSpeaking}
                variant="outline"
                size="lg"
                className="px-6 sm:px-8 w-full sm:w-auto"
              >
                {isSpeaking ? (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    <span className="hidden sm:inline">Stop Speaking</span>
                    <span className="sm:hidden">Stop</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-5 w-5 mr-2" />
                    <span className="hidden sm:inline">Muted</span>
                    <span className="sm:hidden">Mute</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {isListening && "🎤 Listening... Speak now"}
            {isSpeaking && "🔊 Playing response..."}
            {!isListening && !isSpeaking && isConnected && "Ready to listen"}
            {!isConnected && "Connect to start voice chat"}
          </p>
        </div>
      </Card>

      {/* Messages */}
      <Card className="flex-1 mb-4 overflow-hidden">
        <ScrollArea className="h-full p-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Start Voice Chat</h3>
                <p className="text-muted-foreground">
                  Connect to the voice agent and start speaking to analyze your documents
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.type === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.type === "system"
                        ? "bg-blue-100 text-blue-900"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <div className="text-xs opacity-70 mt-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Quick Actions */}
      {isConnected && (
        <div className="flex gap-2 justify-center flex-wrap">
          <p className="text-sm text-muted-foreground w-full text-center mb-2">
            💡 Click "Start Speaking" and say these questions:
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            {[
              "What are the main topics?",
              "Explain this concept",
              "Give me a summary",
              "Create a quiz"
            ].map((text) => (
              <Button
                key={text}
                variant="outline"
                size="sm"
                disabled
                className="opacity-60"
              >
                {text}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
