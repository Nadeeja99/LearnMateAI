/** Browser audio helpers for the voice agent. */

// Preference order. Chrome/Firefox record WebM/Opus; Safari only supports MP4/AAC.
// The backend maps the chosen type to the file extension Whisper needs.
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** First recording format this browser supports, or undefined to let the browser choose. */
export function pickRecordingMimeType(isTypeSupported: (type: string) => boolean = (t) => MediaRecorder.isTypeSupported?.(t) ?? false) {
  return RECORDING_TYPES.find((type) => isTypeSupported(type));
}

/** Base64 payload of a Blob (without the data: URL prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Object URL for base64-encoded audio from the server (caller must revoke it). */
export function base64AudioUrl(base64Audio: string, type = "audio/mpeg"): string {
  const bytes = Uint8Array.from(atob(base64Audio), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type }));
}
