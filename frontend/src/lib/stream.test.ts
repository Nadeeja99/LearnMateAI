import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, isAbortError } from "./http";
import { frameBatched, streamCompletion } from "./stream";

const TELEMETRY = {
  model: "gpt-test",
  ttft_ms: 120,
  retrieval_ms: 40,
  generation_ms: 300,
  total_ms: 360,
  tokens_per_second: 50,
  finish_reason: "stop",
  usage: { input_tokens: 100, output_tokens: 3, total_tokens: 103, estimated: false },
  system_prompt: "Context: ...",
  sources: [{ rank: 1, source: "biology.pdf", distance: 0.2, characters: 54, preview: "Mitochondria…" }],
};

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function mockFetch(body: string, init: ResponseInit = { status: 200 }) {
  const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return new Response(body, { headers: { "Content-Type": "text/event-stream" }, ...init });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("streamCompletion", () => {
  it("accumulates tokens, reports meta, and returns validated telemetry with client timing", async () => {
    const fetchMock = mockFetch(
      sse("meta", { model: "gpt-test", sources: TELEMETRY.sources }) +
        sse("token", { content: "Hello" }) +
        sse("token", { content: " world" }) +
        sse("done", { conversation_id: "conv_1", telemetry: TELEMETRY }),
    );
    const onMeta = vi.fn();
    const onText = vi.fn();

    const result = await streamCompletion("/ask/stream", { question: "Hi?" }, { onMeta, onText });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ question: "Hi?" }) });
    expect(onMeta).toHaveBeenCalledWith({ model: "gpt-test", sources: TELEMETRY.sources });
    expect(onText.mock.calls.map(([text]) => text)).toEqual(["Hello", "Hello world"]);
    expect(result.text).toBe("Hello world");
    expect(result.conversationId).toBe("conv_1");
    expect(result.telemetry?.usage.total_tokens).toBe(103);
    expect(result.telemetry?.client?.ttft_ms).toBeGreaterThanOrEqual(0);
  });

  it("throws the server's message on an error event", async () => {
    mockFetch(sse("meta", { model: "m", sources: [] }) + sse("error", { type: "error", message: "No suitable content found" }));
    await expect(streamCompletion("/summarize/stream", {})).rejects.toEqual(new ApiError("No suitable content found"));
  });

  it("surfaces FastAPI detail for non-2xx responses", async () => {
    mockFetch(JSON.stringify({ detail: "No documents uploaded yet." }), { status: 400 });
    await expect(streamCompletion("/ask/stream", {})).rejects.toMatchObject({ message: "No documents uploaded yet.", status: 400 });
  });

  it("rejects when the stream ends without a done event", async () => {
    mockFetch(sse("token", { content: "partial" }));
    await expect(streamCompletion("/ask/stream", {})).rejects.toThrow("ended unexpectedly");
  });

  it("propagates aborts as AbortError", async () => {
    mockFetch("");
    const controller = new AbortController();
    controller.abort();
    const error = await streamCompletion("/ask/stream", {}, { signal: controller.signal }).catch((e) => e);
    expect(isAbortError(error)).toBe(true);
  });

  it("ignores malformed telemetry instead of failing the response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockFetch(sse("token", { content: "ok" }) + sse("done", { telemetry: { model: 42 } }));
    const result = await streamCompletion("/ask/stream", {});
    expect(result.text).toBe("ok");
    expect(result.telemetry).toBeUndefined();
  });
});

describe("frameBatched", () => {
  it("delivers only the latest value per frame, and flush delivers immediately", async () => {
    const fn = vi.fn();
    const batched = frameBatched(fn);
    batched("a");
    batched("ab");
    batched.flush();
    expect(fn.mock.calls).toEqual([["ab"]]);

    batched("abc");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fn.mock.calls).toEqual([["ab"], ["abc"]]);
  });
});
