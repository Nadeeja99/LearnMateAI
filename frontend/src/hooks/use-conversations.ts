import { useCallback, useEffect, useState } from "react";
import API_CONFIG from "@/lib/api";
import { errorText, requestJson } from "@/lib/http";
import type { Conversation } from "@/components/app/chat/types";

/** Loads the user's conversation list with loading and error state. */
export function useConversations(userId = "default") {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const data = await requestJson<{ conversations?: Conversation[] }>(API_CONFIG.ENDPOINTS.USER_CONVERSATIONS(userId));
      setConversations(data.conversations || []);
    } catch (err) {
      setError(errorText(err, "Couldn't load conversations"));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { conversations, isLoading, error, reload };
}
