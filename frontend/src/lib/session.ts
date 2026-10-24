/**
 * Anonymous per-browser session id, sent as X-Session-Id on every API request.
 * The backend keeps each session's documents and conversations separate.
 */

const STORAGE_KEY = "learnmate-session-id";
let cached: string | null = null;

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID needs a secure context; fall back to getRandomValues (still unguessable)
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export function getSessionId(): string {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) {
      cached = generateId();
      localStorage.setItem(STORAGE_KEY, cached);
    }
  } catch {
    // Storage blocked (e.g. some private modes): keep the id for this page load only
    cached ??= generateId();
  }
  return cached;
}
