import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useHotkey } from "@/hooks/use-hotkey";
import { cn } from "@/lib/utils";
import Kbd from "@/components/app/Kbd";
import { OPTION_KEYS, type Question } from "./types";

interface QuizQuestionProps {
  question: Question;
  index: number;
  total: number;
  score: number;
  showAnswer: boolean;
  onAnswer: (answer: string) => void;
  onSubmit: () => void;
  onNext: () => void;
}

/** One quiz question. Keyboard: A–D or 1–4 to choose, Enter to submit / continue. */
const QuizQuestion = ({ question, index, total, score, showAnswer, onAnswer, onSubmit, onNext }: QuizQuestionProps) => {
  const isLast = index === total - 1;

  useHotkey(
    OPTION_KEYS.flatMap((key, i) => [{ key }, { key: String(i + 1) }]),
    (event) => {
      const pressed = event.key.toUpperCase();
      const key = /^[1-4]$/.test(pressed) ? OPTION_KEYS[Number(pressed) - 1] : pressed;
      if (key in question.options) onAnswer(key);
    },
    { enabled: !showAnswer },
  );
  useHotkey({ key: "Enter" }, () => (showAnswer ? onNext() : question.userAnswer && onSubmit()));

  const optionClass = (key: string) => {
    if (!showAnswer) {
      return question.userAnswer === key ? "border-primary bg-primary/5" : "hover:border-foreground/20 hover:bg-accent/40";
    }
    if (key === question.correct_answer) return "border-success/50 bg-success/10";
    if (key === question.userAnswer) return "border-destructive/50 bg-destructive/10";
    return "opacity-60";
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Question {index + 1} of {total}
          </p>
          <h2 className="mt-1 text-lg font-semibold">Quiz</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {score}/{total}
          </p>
        </div>
      </div>

      <Progress value={((index + 1) / total) * 100} className="mb-8 h-1.5" />

      <h3 className="mb-6 text-lg font-medium leading-snug sm:text-xl">{question.question}</h3>

      <RadioGroup value={question.userAnswer || ""} onValueChange={onAnswer} disabled={showAnswer} className="gap-2.5">
        {Object.entries(question.options).map(([key, value]) => (
          <Label
            key={key}
            htmlFor={`option-${key}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-[0.9375rem] font-normal leading-relaxed transition-colors",
              optionClass(key),
            )}
          >
            <RadioGroupItem value={key} id={`option-${key}`} className="mt-0.5" />
            <span className="flex-1">
              <span className="mr-2 font-medium">{key}.</span>
              {value}
            </span>
            {showAnswer && key === question.correct_answer && <CheckCircle className="h-5 w-5 shrink-0 text-success" />}
            {showAnswer && key === question.userAnswer && key !== question.correct_answer && (
              <XCircle className="h-5 w-5 shrink-0 text-destructive" />
            )}
            {!showAnswer && <Kbd className="hidden sm:inline-flex">{key}</Kbd>}
          </Label>
        ))}
      </RadioGroup>

      {showAnswer && (
        <div className="mt-6 rounded-lg border bg-muted/40 p-4 animate-fade-up">
          <h4 className="text-sm font-medium">Explanation</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
        </div>
      )}

      <div className="mt-8">
        {!showAnswer ? (
          <Button onClick={onSubmit} disabled={!question.userAnswer} className="w-full" size="lg">
            Submit answer
            <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80">↵</Kbd>
          </Button>
        ) : (
          <Button onClick={onNext} className="w-full" size="lg">
            {isLast ? "Finish quiz" : "Next question"}
            <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80">↵</Kbd>
          </Button>
        )}
      </div>
    </Card>
  );
};

export default QuizQuestion;
