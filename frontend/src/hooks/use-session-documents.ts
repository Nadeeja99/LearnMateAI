import { useCallback, useEffect, useState } from "react";
import API_CONFIG from "@/lib/api";
import { errorText, requestJson } from "@/lib/http";

/** Per-document summary from GET /current-session-documents (see VectorStore.document_summaries) */
export interface DocumentDetails {
  filename: string;
  chunks_count: number;
  file_size: number | null;
  uploaded_at: string | null;
}

interface SessionDocumentsResponse {
  documents?: string[];
  details?: Record<string, DocumentDetails>;
}

/** The current session's documents (persisted server-side), with loading and error state. */
export function useSessionDocuments() {
  const [documents, setDocuments] = useState<string[]>([]);
  const [details, setDetails] = useState<Record<string, DocumentDetails>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await requestJson<SessionDocumentsResponse>(API_CONFIG.ENDPOINTS.CURRENT_SESSION_DOCUMENTS);
      setDocuments(data.documents || []);
      setDetails(data.details || {});
    } catch (err) {
      console.error("Error fetching current session documents:", err);
      setError(errorText(err, "Couldn't load session documents"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Optimistic updates; the follow-up refresh brings back the server's view (chunk counts, dates). */
  const added = (filename: string) => {
    setDocuments((prev) => (prev.includes(filename) ? prev : [...prev, filename]));
    refresh();
  };
  const removed = (filename: string) => {
    setDocuments((prev) => prev.filter((doc) => doc !== filename));
    refresh();
  };

  return { documents, details, isLoading, error, refresh, added, removed };
}
