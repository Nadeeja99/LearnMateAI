import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);

  const clientId = useRef(`voice_client_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`).current;
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Leaving the view must release the socket, the microphone, and any playing audio
  useEffect(
    () => () => {
      const socket = websocketRef.current;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const speakWithBrowser = (text: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text || "Response received");
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Fallback audio also failed:", error);
      setIsSpeaking(false);
    }
  };

  const playAudio = async (base64Audio: string, fallbackText: string) => {
    try {
      setIsSpeaking(true);
      const bytes = Uint8Array.from(atob(base64Audio), (char) => char.charCodeAt(0));
      const audioUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      const finish = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onended = finish;
      audio.onerror = finish;
      await audio.play();
    } catch (error) {
      console.error("Error playing audio:", error);
      speakWithBrowser(fallbackText);
    }
  };

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
      if (message.audio) playAudio(message.audio, message.text);
      else speakWithBrowser(message.text);
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
        setIsSpeaking(false);
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
    setIsSpeaking(false);
  };

  const sendAudio = (audioBlob: Blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result?.toString().split(",")[1];
      if (base64Audio && websocketRef.current) {
        websocketRef.current.send(JSON.stringify({ type: "voice", audio: base64Audio, timestamp: new Date().toISOString() }));
      }
    };
    reader.readAsDataURL(audioBlob);
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
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        sendAudio(new Blob(chunks, { type: "audio/webm" }));
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

  /** Stops the spoken reply (audio element or browser speech synthesis). */
  const stopSpeaking = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  return { isConnected, isConnecting, isListening, isSpeaking, messages, connect, disconnect, startListening, stopListening, stopSpeaking };
}
