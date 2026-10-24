export type OptionKey = "A" | "B" | "C" | "D";

export interface Question {
  question: string;
  options: Record<OptionKey, string>;
  correct_answer: string;
  explanation: string;
  userAnswer?: string;
}

export const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];
