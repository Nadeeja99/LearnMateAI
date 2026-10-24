import { describe, expect, it, vi } from "vitest";
import { formatCount, formatMs, parseTelemetry } from "./telemetry";
import { quizResponseSchema } from "@/components/app/quiz/types";

describe("formatMs", () => {
  it("formats milliseconds and seconds", () => {
    expect(formatMs(420.4)).toBe("420 ms");
    expect(formatMs(1234)).toBe("1.23 s");
    expect(formatMs(null)).toBe("–");
  });
});

describe("formatCount", () => {
  it("formats counts and missing values", () => {
    expect(formatCount(1234)).toBe((1234).toLocaleString());
    expect(formatCount(undefined)).toBe("–");
  });
});

describe("parseTelemetry", () => {
  it("accepts persisted telemetry without a system prompt", () => {
    const stored = {
      model: "gpt-test",
      ttft_ms: null,
      retrieval_ms: 10,
      generation_ms: 0,
      total_ms: 10,
      tokens_per_second: null,
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: false },
      sources: [],
    };
    expect(parseTelemetry(stored)?.model).toBe("gpt-test");
  });

  it("returns undefined for missing or malformed telemetry", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(parseTelemetry(undefined)).toBeUndefined();
    expect(parseTelemetry({ model: "x" })).toBeUndefined();
  });
});

describe("quizResponseSchema", () => {
  const question = {
    question: "What does the mitochondrion produce?",
    options: { A: "DNA", B: "ATP", C: "Lipids", D: "Glucose" },
    correct_answer: "B",
    explanation: "Cellular respiration.",
  };

  it("accepts a valid quiz", () => {
    expect(quizResponseSchema.safeParse({ quiz: [question], total_questions: 1 }).success).toBe(true);
  });

  it("rejects empty quizzes and invalid answer letters", () => {
    const empty = quizResponseSchema.safeParse({ quiz: [], total_questions: 0 });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0].message).toMatch(/didn't return any questions/);

    expect(quizResponseSchema.safeParse({ quiz: [{ ...question, correct_answer: "E" }], total_questions: 1 }).success).toBe(false);
    expect(quizResponseSchema.safeParse({ quiz: [{ ...question, options: { A: "x" } }], total_questions: 1 }).success).toBe(false);
  });
});
