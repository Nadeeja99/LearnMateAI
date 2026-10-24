import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useHotkey } from "@/hooks/use-hotkey";
import { useAbortController } from "@/hooks/use-abort-controller";
import API_CONFIG from "@/lib/api";
import { errorText, isAbortError, requestJson } from "@/lib/http";
import PageHeader from "@/components/app/PageHeader";
import InlineError from "@/components/app/InlineError";
import QuizSetup, { QuizSkeleton } from "@/components/app/quiz/QuizSetup";
import QuizQuestion from "@/components/app/quiz/QuizQuestion";
import QuizResult from "@/components/app/quiz/QuizResult";
import type { Question } from "@/components/app/quiz/types";

interface QuizViewProps {
  documents: string[];
}

interface QuizResponse {
  quiz: Question[];
  total_questions: number;
}

const QuizView = ({ documents }: QuizViewProps) => {
  const [numQuestions, setNumQuestions] = useState([5]);
  const [difficulty, setDifficulty] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const request = useAbortController();
  const { toast } = useToast();
  const isSetup = questions.length === 0 && !quizCompleted;

  const handleGenerate = async () => {
    if (documents.length === 0) {
      toast({ title: "No documents uploaded", description: "Please upload a document first", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const data = await requestJson<QuizResponse>(API_CONFIG.ENDPOINTS.QUIZ, {
        method: "POST",
        signal: request.begin(),
        json: { num_questions: numQuestions[0], difficulty },
      });
      if (!data.quiz?.length) {
        throw new Error("The model didn't return any questions. Try again or lower the question count.");
      }
      setQuestions(data.quiz);
      setCurrentQuestion(0);
      setScore(0);
      setShowAnswer(false);
      setQuizCompleted(false);
    } catch (err) {
      if (!isAbortError(err)) setError(errorText(err, "Failed to generate quiz."));
    } finally {
      setIsGenerating(false);
    }
  };

  useHotkey({ key: "Enter", mod: true }, handleGenerate, { enabled: isSetup && !isGenerating && documents.length > 0 });
  useHotkey({ key: "Escape" }, request.abort, { enabled: isGenerating });

  const handleAnswer = (answer: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === currentQuestion ? { ...q, userAnswer: answer } : q)));
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
      await requestJson(API_CONFIG.ENDPOINTS.TRACK_QUIZ, {
        method: "POST",
        json: {
          user_id: "default",
          quiz_score: score,
          total_questions: questions.length,
          score_percentage: getScorePercentage(),
          completed_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("Error tracking quiz completion:", err);
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

  if (quizCompleted) {
    return <QuizResult score={score} total={questions.length} percentage={getScorePercentage()} onRetake={handleRetake} />;
  }

  if (isSetup) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Generate a quiz" description="Test your knowledge with questions drawn from your uploaded documents" />
        {error && <InlineError className="mb-6" title="Couldn't generate the quiz" message={error} onRetry={handleGenerate} />}
        {documents.length === 0 && (
          <InlineError className="mb-6" tone="muted" title="No documents yet" message="Upload a PDF from the sidebar to generate a quiz." />
        )}
        <QuizSetup
          numQuestions={numQuestions}
          onNumQuestionsChange={setNumQuestions}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          isGenerating={isGenerating}
          disabled={documents.length === 0}
          onGenerate={handleGenerate}
          onCancel={request.abort}
        />
        {isGenerating && <QuizSkeleton />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <QuizQuestion
        question={questions[currentQuestion]}
        index={currentQuestion}
        total={questions.length}
        score={score}
        showAnswer={showAnswer}
        onAnswer={handleAnswer}
        onSubmit={handleSubmit}
        onNext={handleNext}
      />
    </div>
  );
};

export default QuizView;
