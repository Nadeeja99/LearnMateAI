import { z } from "zod";
import { telemetrySchema } from "@/lib/telemetry";

export const OPTION_KEYS = ["A", "B", "C", "D"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/** Mirrors the Pydantic Quiz schema in backend/app/schemas.py. */
export const questionSchema = z.object({
  question: z.string().min(1),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correct_answer: z.enum(OPTION_KEYS),
  explanation: z.string(),
});

export const quizResponseSchema = z.object({
  quiz: z.array(questionSchema).min(1, "The model didn't return any questions. Try again or lower the question count."),
  total_questions: z.number(),
  telemetry: telemetrySchema.optional(),
});

export type Question = z.infer<typeof questionSchema> & { userAnswer?: string };
