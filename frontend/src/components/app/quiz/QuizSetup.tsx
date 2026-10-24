import { HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { MOD_KEY_LABEL } from "@/lib/keyboard";
import Kbd from "@/components/app/Kbd";

interface QuizSetupProps {
  numQuestions: number[];
  onNumQuestionsChange: (value: number[]) => void;
  difficulty: string;
  onDifficultyChange: (value: string) => void;
  isGenerating: boolean;
  disabled: boolean;
  onGenerate: () => void;
  onCancel: () => void;
}

const QuizSetup = ({
  numQuestions,
  onNumQuestionsChange,
  difficulty,
  onDifficultyChange,
  isGenerating,
  disabled,
  onGenerate,
  onCancel,
}: QuizSetupProps) => (
  <Card className="space-y-8 p-6 sm:p-8">
    <fieldset disabled={isGenerating} className="space-y-8 disabled:opacity-60">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-medium">Number of questions</Label>
          <span className="text-sm font-medium tabular-nums">{numQuestions[0]}</span>
        </div>
        <Slider value={numQuestions} onValueChange={onNumQuestionsChange} max={20} min={1} step={1} disabled={isGenerating} aria-label="Number of questions" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>20</span>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Difficulty</Label>
        <RadioGroup value={difficulty} onValueChange={onDifficultyChange} disabled={isGenerating} className="grid grid-cols-3 gap-2">
          {["easy", "medium", "hard"].map((level) => (
            <Label
              key={level}
              htmlFor={level}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm capitalize transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                difficulty === level ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              <RadioGroupItem value={level} id={level} className="sr-only" />
              {level}
            </Label>
          ))}
        </RadioGroup>
      </div>
    </fieldset>

    {isGenerating ? (
      <Button onClick={onCancel} variant="outline" className="w-full" size="lg">
        <Loader2 className="animate-spin" />
        Generating {numQuestions[0]} questions… Cancel
        <Kbd className="ml-1">Esc</Kbd>
      </Button>
    ) : (
      <Button onClick={onGenerate} disabled={disabled} className="w-full" size="lg">
        <HelpCircle />
        Generate quiz
        <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80">{MOD_KEY_LABEL} ↵</Kbd>
      </Button>
    )}
  </Card>
);

/** Preview of the question card shown while a quiz is generated. */
export const QuizSkeleton = () => (
  <Card className="mt-6 p-6 sm:p-8" aria-busy="true" aria-label="Generating quiz">
    <div className="mb-6 flex justify-between">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-12" />
    </div>
    <Skeleton className="mb-8 h-1.5 w-full" />
    <Skeleton className="mb-2 h-6 w-4/5" />
    <Skeleton className="mb-6 h-6 w-1/2" />
    <div className="space-y-2.5">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  </Card>
);

export default QuizSetup;
