import { z } from "zod";

/** Mirrors RAGChain._build_telemetry in backend/app/rag_chain.py. */

export const sourceChunkSchema = z.object({
  rank: z.number(),
  source: z.string(),
  /** FAISS L2 distance: lower means closer to the query. */
  distance: z.number(),
  characters: z.number(),
  preview: z.string(),
});

export const telemetrySchema = z.object({
  model: z.string(),
  ttft_ms: z.number().nullable(),
  retrieval_ms: z.number(),
  generation_ms: z.number(),
  total_ms: z.number(),
  tokens_per_second: z.number().nullable(),
  finish_reason: z.string().nullable().optional(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    total_tokens: z.number(),
    estimated: z.boolean(),
  }),
  /** Omitted from telemetry persisted in conversation history. */
  system_prompt: z.string().nullable().optional(),
  sources: z.array(sourceChunkSchema),
  structured_output: z
    .object({ schema: z.string(), method: z.string(), validated: z.boolean(), items: z.number() })
    .optional(),
});

export type SourceChunk = z.infer<typeof sourceChunkSchema>;

export type Telemetry = z.infer<typeof telemetrySchema> & {
  /** Measured in the browser, so it includes network time. */
  client?: { ttft_ms: number | null; total_ms: number };
};

/** Validates telemetry from the API; returns undefined (and logs) rather than throwing on drift. */
export function parseTelemetry(value: unknown): Telemetry | undefined {
  if (value == null) return undefined;
  const result = telemetrySchema.safeParse(value);
  if (!result.success) {
    console.warn("Ignoring malformed telemetry", result.error.issues);
    return undefined;
  }
  return result.data;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "–";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export function formatCount(value: number | null | undefined): string {
  return value == null ? "–" : value.toLocaleString();
}
