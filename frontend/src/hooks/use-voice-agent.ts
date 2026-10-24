import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import { blobToBase64, pickRecordingMimeType } from "@/lib/audio";
import { useSpeechPlayback } from "@/hooks/use-speech-playback";

export interface VoiceMessage {
  id: string;
  type: "user" | "assistant" | "system";
  text: string;
  audio?: string | null;
  timestamp: string;
}

/** Server -> client WebSocket message (see backend voice_agent.py) */
interface VoiceServerMessage {
  type: "welcome" | "response" | "transcribed" | "error" | "pong";
  text: string;
  audio?: string | null;
  timestamp?: string;
}

const LISTENING = "🎤 Listening...";
const PROCESSING = "🎤 Processing...";

/** WebSocket voice session: microphone capture, transcript, and spoken replies. */
export function useVoiceAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);

  const clientId = useRef(`voice_client_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`).current;
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { toast } = useToast();
  const playback = useSpeechPlayback();

  // Leaving the view must release the socket, the microphone, and any playing audio
  useEffect(
    () => () => {
      const socket = websocketRef.current;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const handleServerMessage = (message: VoiceServerMessage) => {
    if (message.type === "transcribed") {
      // Replace the pending user placeholder with what was actually heard
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === prev.length - 1 && msg.type === "user" && (msg.text === LISTENING || msg.text === PROCESSING)
            ? { ...msg, text: message.text }
            : msg,
        ),
      );
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        type: message.type === "welcome" || message.type === "response" ? "assistant" : "system",
        text: message.text,
        audio: message.audio,
        timestamp: message.timestamp || new Date().toISOString(),
      },
    ]);

    if (message.type === "response") {
      if (message.audio) playback.play(message.audio, message.text);
      else playback.speak(message.text);
    }
  };

  const connect = () => {
    if (isConnected) return;
    setIsConnecting(true);
    try {
      const socket = new WebSocket(API_CONFIG.ENDPOINTS.VOICE_WS(clientId));
      websocketRef.current = socket;
      socket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        toast({ title: "Connected to Voice Agent", description: "You can now start speaking to analyze your documents" });
      };
      socket.onmessage = (event) => handleServerMessage(JSON.parse(event.data));
      socket.onclose = () => {
        setIsConnected(false);
        setIsListening(false);
        playback.stop();
        toast({ title: "Disconnected from Voice Agent", description: "Voice chat session ended", variant: "destructive" });
      };
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
        toast({ title: "Connection Error", description: "Failed to connect to voice agent", variant: "destructive" });
      };
    } catch (error) {
      console.error("Error connecting to voice agent:", error);
      setIsConnecting(false);
      toast({ title: "Connection Error", description: "Failed to connect to voice agent", variant: "destructive" });
    }
  };

  const disconnect = () => {
    websocketRef.current?.close();
    websocketRef.current = null;
    setIsConnected(false);
    setIsListening(false);
    playback.stop();
  };

  const sendAudio = async (audioBlob: Blob) => {
    const audio = await blobToBase64(audioBlob);
    if (audio && websocketRef.current) {
      // mime_type lets the server name the file so Whisper decodes Safari's MP4 as well as WebM
      websocketRef.current.send(JSON.stringify({ type: "voice", audio, mime_type: audioBlob.type, timestamp: new Date().toISOString() }));
    }
  };

  const startListening = async () => {
    if (!isConnected) {
      connect();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        sendAudio(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100); // Collect data every 100ms
      setIsListening(true);
      setMessages((prev) => [...prev, { id: `user_${Date.now()}`, type: "user", text: LISTENING, timestamp: new Date().toISOString() }]);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({ title: "Microphone Access Denied", description: "Please allow microphone access to use voice chat", variant: "destructive" });
    }
  };

  const stopListening = () => {
    if (!mediaRecorderRef.current || !isListening) return;
    mediaRecorderRef.current.stop();
    setIsListening(false);
    setMessages((prev) =>
      prev.map((msg, index) => (index === prev.length - 1 && msg.type === "user" && msg.text === LISTENING ? { ...msg, text: PROCESSING } : msg)),
    );
  };

  return {
    isConnected,
    isConnecting,
    isListening,
    isSpeaking: playback.isSpeaking,
    messages,
    connect,
    disconnect,
    startListening,
    stopListening,
    stopSpeaking: playback.stop,
  };
}
