import { useCallback, useEffect, useRef, useState } from "react";
import { base64AudioUrl } from "@/lib/audio";

/** Plays spoken replies: server TTS audio, falling back to the browser's speech synthesis. */
export function useSpeechPlayback() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]); // never keep talking after the view unmounts

  const speak = useCallback((text: string) => {
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
  }, []);

  const play = useCallback(
    async (base64Audio: string, fallbackText: string) => {
      try {
        setIsSpeaking(true);
        const audioUrl = base64AudioUrl(base64Audio);
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
        speak(fallbackText);
      }
    },
    [speak],
  );

  return { isSpeaking, play, speak, stop };
}
