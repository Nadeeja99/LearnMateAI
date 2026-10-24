import { ApiError, fetchChecked } from "@/lib/http";
import { parseSSE } from "@/lib/sse";
import { parseTelemetry, sourceChunkSchema, type SourceChunk, type Telemetry } from "@/lib/telemetry";

export interface StreamHandlers {
  signal?: AbortSignal;
  /** Retrieval finished; called before the first token. */
  onMeta?: (meta: { model: string; sources: SourceChunk[] }) => void;
  /** Called with the accumulated text after every token. */
  onText?: (text: string) => void;
}

export interface StreamResult {
  text: string;
  telemetry?: Telemetry;
  conversationId?: string;
}

/**
 * POSTs to a backend SSE endpoint (meta, token*, done | error) and accumulates the text.
 * Aborting the signal cancels the request, which also stops generation server-side.
 */
export async function streamCompletion(url: string, body: unknown, { signal, onMeta, onText }: StreamHandlers = {}): Promise<StreamResult> {
  const startedAt = performance.now();
  let firstTokenAt: number | null = null;
  let text = "";

  const response = await fetchChecked(url, { method: "POST", json: body, signal, headers: { Accept: "text/event-stream" } });
  if (!response.body) throw new ApiError("Streaming is not supported by this browser.");

  for await (const { event, data } of parseSSE(response.body)) {
    const payload = JSON.parse(data);

    if (event === "meta") {
      onMeta?.({ model: payload.model, sources: sourceChunkSchema.array().catch([]).parse(payload.sources) });
    } else if (event === "token") {
      firstTokenAt ??= performance.now();
      text += payload.content;
      onText?.(text);
    } else if (event === "error") {
      throw new ApiError(payload.message || "Generation failed. Please try again.");
    } else if (event === "done") {
      const telemetry = parseTelemetry(payload.telemetry);
      const client = { ttft_ms: firstTokenAt === null ? null : firstTokenAt - startedAt, total_ms: performance.now() - startedAt };
      return { text, telemetry: telemetry && { ...telemetry, client }, conversationId: payload.conversation_id };
    }
  }

  throw new ApiError("The response ended unexpectedly. Please try again.");
}

/**
 * Coalesces rapid calls to at most one per animation frame, always delivering the latest value.
 * Keeps per-token streaming from re-rendering (and re-parsing Markdown) hundreds of times a second.
 */
export function frameBatched<T>(fn: (value: T) => void): ((value: T) => void) & { flush: () => void } {
  const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 16);
  let pending: { value: T } | null = null;
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    if (pending) {
      const { value } = pending;
      pending = null;
      fn(value);
    }
  };

  const batched = (value: T) => {
    pending = { value };
    if (!scheduled) {
      scheduled = true;
      schedule(flush);
    }
  };
  return Object.assign(batched, { flush });
}
