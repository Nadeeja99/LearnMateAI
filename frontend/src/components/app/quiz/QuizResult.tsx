import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface QuizResultProps {
  score: number;
  total: number;
  percentage: number;
  onRetake: () => void;
}

const scoreColor = (percentage: number) => {
  if (percentage >= 80) return "text-success";
  if (percentage >= 60) return "text-warning";
  return "text-destructive";
};

const QuizResult = ({ score, total, percentage, onRetake }: QuizResultProps) => (
  <div className="mx-auto max-w-2xl">
    <Card className="px-6 py-12 text-center sm:px-10 animate-fade-up">
      <p className="text-sm font-medium text-muted-foreground">Quiz completed</p>
      <div className={`mt-4 text-6xl font-semibold tabular-nums tracking-tight ${scoreColor(percentage)}`}>{percentage}%</div>
      <p className="mt-3 text-muted-foreground">
        {score} out of {total} correct
      </p>
      <Button onClick={onRetake} variant="outline" size="lg" className="mt-10" autoFocus>
        <RotateCcw />
        Take another quiz
      </Button>
    </Card>
  </div>
);

export default QuizResult;
