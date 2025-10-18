import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, HelpCircle, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuizViewProps {
  documents: string[];
}

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  userAnswer?: number;
}

const QuizView = ({ documents }: QuizViewProps) => {
  const [numQuestions, setNumQuestions] = useState([10]);
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
      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:8000/generate-quiz?num_questions=${numQuestions[0]}`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        // Mock quiz data for now
        const mockQuestions: Question[] = Array.from({ length: numQuestions[0] }, (_, i) => ({
          question: `Sample Question ${i + 1}: What is the main topic discussed in the document?`,
          options: [
            "Option A: First possible answer",
            "Option B: Second possible answer",
            "Option C: Third possible answer",
            "Option D: Fourth possible answer",
          ],
          correctAnswer: Math.floor(Math.random() * 4),
        }));
        
        setQuestions(mockQuestions);
        setCurrentQuestion(0);
        setScore(0);
        setQuizCompleted(false);
        
        toast({
          title: "Quiz generated!",
          description: `${numQuestions[0]} questions are ready`,
        });
      } else {
        throw new Error("Failed to generate quiz");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestion].userAnswer = answerIndex;
    setQuestions(updatedQuestions);
  };

  const handleSubmit = () => {
    const currentQ = questions[currentQuestion];
    if (currentQ.userAnswer === currentQ.correctAnswer) {
      setScore(score + 1);
    }
    setShowAnswer(true);
  };

  const handleNext = () => {
    setShowAnswer(false);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleRetake = () => {
    setQuestions([]);
    setCurrentQuestion(0);
    setScore(0);
    setQuizCompleted(false);
    setShowAnswer(false);
  };

  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold mb-2">Create Quiz</h2>
          <p className="text-muted-foreground">
            Generate practice questions from your documents
          </p>
        </div>

        {/* Configuration */}
        <Card className="p-8 max-w-2xl mx-auto">
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-semibold">Number of Questions</Label>
                <span className="text-2xl font-bold text-primary">{numQuestions[0]}</span>
              </div>
              <Slider
                value={numQuestions}
                onValueChange={setNumQuestions}
                min={5}
                max={20}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>5</span>
                <span>20</span>
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold mb-4 block">Difficulty Level</Label>
              <RadioGroup value={difficulty} onValueChange={setDifficulty}>
                <div className="grid grid-cols-3 gap-4">
                  {["easy", "medium", "hard"].map((level) => (
                    <div key={level}>
                      <RadioGroupItem value={level} id={level} className="peer sr-only" />
                      <Label
                        htmlFor={level}
                        className="flex items-center justify-center rounded-lg border-2 border-muted bg-muted/50 p-4 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                      >
                        <span className="capitalize font-semibold">{level}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || documents.length === 0}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-secondary"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Generate Quiz
                </>
              )}
            </Button>
          </div>
        </Card>

        {documents.length === 0 && (
          <Card className="p-8 text-center max-w-2xl mx-auto">
            <p className="text-muted-foreground">
              Upload a document first to generate a quiz
            </p>
          </Card>
        )}
      </div>
    );
  }

  if (quizCompleted) {
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <div className="space-y-6">
        <Card className="p-12 max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          
          <h2 className="text-3xl font-bold mb-4">Quiz Complete!</h2>
          
          <div className="text-6xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {percentage}%
          </div>
          
          <p className="text-xl text-muted-foreground mb-8">
            You scored {score} out of {questions.length} questions
          </p>
          
          <div className="flex gap-4 justify-center">
            <Button onClick={handleRetake} size="lg" variant="outline">
              Retake Quiz
            </Button>
            <Button onClick={() => setQuestions([])} size="lg">
              Create New Quiz
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">Quiz</h2>
          <p className="text-muted-foreground">
            Question {currentQuestion + 1} of {questions.length}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Score</div>
          <div className="text-2xl font-bold text-primary">{score}/{questions.length}</div>
        </div>
      </div>

      {/* Question Card */}
      <Card className="p-8">
        <div className="space-y-6">
          <h3 className="text-xl font-semibold leading-relaxed">{currentQ.question}</h3>
          
          <RadioGroup
            value={currentQ.userAnswer?.toString()}
            onValueChange={(value) => handleAnswer(parseInt(value))}
          >
            <div className="space-y-3">
              {currentQ.options.map((option, index) => {
                const isSelected = currentQ.userAnswer === index;
                const isCorrect = index === currentQ.correctAnswer;
                const showCorrect = showAnswer && isCorrect;
                const showIncorrect = showAnswer && isSelected && !isCorrect;
                
                return (
                  <div key={index}>
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} className="peer sr-only" />
                    <Label
                      htmlFor={`option-${index}`}
                      className={`flex items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-all ${
                        showCorrect
                          ? "border-success bg-success/10"
                          : showIncorrect
                          ? "border-destructive bg-destructive/10"
                          : isSelected
                          ? "border-primary bg-primary/10"
                          : "border-muted bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <span>{option}</span>
                      {showCorrect && <CheckCircle className="h-5 w-5 text-success" />}
                      {showIncorrect && <XCircle className="h-5 w-5 text-destructive" />}
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>

          <div className="flex gap-4 pt-4">
            {!showAnswer ? (
              <Button
                onClick={handleSubmit}
                disabled={currentQ.userAnswer === undefined}
                className="flex-1"
              >
                Submit Answer
              </Button>
            ) : (
              <Button onClick={handleNext} className="flex-1">
                {currentQuestion < questions.length - 1 ? "Next Question" : "Finish Quiz"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QuizView;
