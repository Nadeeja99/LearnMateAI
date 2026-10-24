import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, HelpCircle, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import PageHeader from "@/components/app/PageHeader";

interface QuizViewProps {
  documents: string[];
}

interface Question {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: string;
  explanation: string;
  userAnswer?: string;
}

const QuizView = ({ documents }: QuizViewProps) => {
  const [numQuestions, setNumQuestions] = useState([5]);
  const [difficulty, setDifficulty] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (documents.length === 0) {
      toast({
        title: "No documents uploaded",
        description: "Please upload a document first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Get current session documents from backend
      const sessionResponse = await fetch(API_CONFIG.ENDPOINTS.CURRENT_SESSION_DOCUMENTS);
      const sessionData = await sessionResponse.json();
      
      console.log("Current session documents for quiz:", sessionData.documents);
      
      const response = await fetch(API_CONFIG.ENDPOINTS.QUIZ, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num_questions: numQuestions[0],
          difficulty: difficulty,
          session_documents: sessionData.documents
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuestions(data.quiz);
        setCurrentQuestion(0);
        setScore(0);
        setShowAnswer(false);
        setQuizCompleted(false);
        
        toast({
          title: "Quiz generated!",
          description: `${data.total_questions} questions are ready`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate quiz");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (answer: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestion].userAnswer = answer;
    setQuestions(updatedQuestions);
  };

  const handleSubmit = () => {
    const currentQ = questions[currentQuestion];
    if (currentQ.userAnswer === currentQ.correct_answer) {
      setScore(score + 1);
    }
    setShowAnswer(true);
  };

  const handleNext = async () => {
    setShowAnswer(false);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setQuizCompleted(true);
      // Track quiz completion analytics
      await trackQuizCompletion();
    }
  };

  const trackQuizCompletion = async () => {
    try {
      const response = await fetch(API_CONFIG.ENDPOINTS.TRACK_QUIZ, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "default",
          quiz_score: score,
          total_questions: questions.length,
          score_percentage: getScorePercentage(),
          completed_at: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        console.log("Quiz completion tracked successfully");
      }
    } catch (error) {
      console.error("Error tracking quiz completion:", error);
    }
  };

  const handleRetake = () => {
    setQuestions([]);
    setCurrentQuestion(0);
    setShowAnswer(false);
    setScore(0);
    setQuizCompleted(false);
  };

  const getScorePercentage = () => {
    if (questions.length === 0) return 0;
    return Math.round((score / questions.length) * 100);
  };

  const getScoreColor = () => {
    const percentage = getScorePercentage();
    if (percentage >= 80) return "text-success";
    if (percentage >= 60) return "text-warning";
    return "text-destructive";
  };

  if (quizCompleted) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="px-6 py-12 text-center sm:px-10 animate-fade-up">
          <p className="text-sm font-medium text-muted-foreground">Quiz completed</p>
          <div className={`mt-4 text-6xl font-semibold tabular-nums tracking-tight ${getScoreColor()}`}>
            {getScorePercentage()}%
          </div>
          <p className="mt-3 text-muted-foreground">
            {score} out of {questions.length} correct
          </p>
          <Button onClick={handleRetake} variant="outline" size="lg" className="mt-10">
            <RotateCcw />
            Take another quiz
          </Button>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Generate a quiz" description="Test your knowledge with questions drawn from your uploaded documents" />
        <Card className="space-y-8 p-6 sm:p-8">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <Label className="text-sm font-medium">Number of questions</Label>
              <span className="text-sm font-medium tabular-nums">{numQuestions[0]}</span>
            </div>
            <Slider value={numQuestions} onValueChange={setNumQuestions} max={20} min={1} step={1} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Difficulty</Label>
            <RadioGroup value={difficulty} onValueChange={setDifficulty} className="grid grid-cols-3 gap-2">
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

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" />
                Generating quiz…
              </>
            ) : (
              <>
                <HelpCircle />
                Generate quiz
              </>
            )}
          </Button>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  const optionClass = (key: string) => {
    if (!showAnswer) {
      return currentQ.userAnswer === key
        ? "border-primary bg-primary/5"
        : "hover:border-foreground/20 hover:bg-accent/40";
    }
    if (key === currentQ.correct_answer) return "border-success/50 bg-success/10";
    if (key === currentQ.userAnswer) return "border-destructive/50 bg-destructive/10";
    return "opacity-60";
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {questions.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold">Quiz</h2>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Score</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {score}/{questions.length}
            </p>
          </div>
        </div>

        <Progress value={((currentQuestion + 1) / questions.length) * 100} className="mb-8 h-1.5" />

        <h3 className="mb-6 text-lg font-medium leading-snug sm:text-xl">{currentQ.question}</h3>

        <RadioGroup value={currentQ.userAnswer || ""} onValueChange={handleAnswer} disabled={showAnswer} className="gap-2.5">
          {Object.entries(currentQ.options).map(([key, value]) => (
            <Label
              key={key}
              htmlFor={`option-${key}`}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-[0.9375rem] font-normal leading-relaxed transition-colors ${optionClass(key)}`}
            >
              <RadioGroupItem value={key} id={`option-${key}`} className="mt-0.5" />
              <span className="flex-1">
                <span className="mr-2 font-medium">{key}.</span>
                {value}
              </span>
              {showAnswer && key === currentQ.correct_answer && <CheckCircle className="h-5 w-5 shrink-0 text-success" />}
              {showAnswer && key === currentQ.userAnswer && key !== currentQ.correct_answer && (
                <XCircle className="h-5 w-5 shrink-0 text-destructive" />
              )}
            </Label>
          ))}
        </RadioGroup>

        {showAnswer && (
          <div className="mt-6 rounded-lg border bg-muted/40 p-4 animate-fade-up">
            <h4 className="text-sm font-medium">Explanation</h4>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{currentQ.explanation}</p>
          </div>
        )}

        <div className="mt-8">
          {!showAnswer ? (
            <Button onClick={handleSubmit} disabled={!currentQ.userAnswer} className="w-full" size="lg">
              Submit answer
            </Button>
          ) : (
            <Button onClick={handleNext} className="w-full" size="lg">
              {currentQuestion < questions.length - 1 ? "Next question" : "Finish quiz"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default QuizView;
