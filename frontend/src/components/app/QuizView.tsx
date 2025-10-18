import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, HelpCircle, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      const sessionResponse = await fetch("http://localhost:8000/current-session-documents");
      const sessionData = await sessionResponse.json();
      
      console.log("Current session documents for quiz:", sessionData.documents);
      
      const response = await fetch("http://localhost:8000/generate-quiz", {
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
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (quizCompleted) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8 text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold mb-2">Quiz Completed!</h2>
            <p className="text-gray-600">Here's how you did</p>
          </div>
          
          <div className="mb-8">
            <div className={`text-6xl font-bold mb-2 ${getScoreColor()}`}>
              {getScorePercentage()}%
            </div>
            <p className="text-xl text-gray-600">
              {score} out of {questions.length} correct
            </p>
          </div>
          
          <div className="flex gap-4 justify-center">
            <Button onClick={handleRetake} variant="outline" size="lg">
              <RotateCcw className="w-4 h-4 mr-2" />
              Take Another Quiz
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8">
          <div className="text-center mb-8">
            <HelpCircle className="w-16 h-16 mx-auto mb-4 text-blue-500" />
            <h2 className="text-2xl font-bold mb-2">Generate Quiz</h2>
            <p className="text-gray-600">
              Create a quiz from your uploaded documents to test your knowledge
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Number of Questions</Label>
              <div className="mt-2">
                <Slider
                  value={numQuestions}
                  onValueChange={setNumQuestions}
                  max={20}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>1</span>
                  <span className="font-medium">{numQuestions[0]} questions</span>
                  <span>20</span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Difficulty Level</Label>
              <RadioGroup
                value={difficulty}
                onValueChange={setDifficulty}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="easy" id="easy" />
                  <Label htmlFor="easy">Easy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="medium" />
                  <Label htmlFor="medium">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hard" id="hard" />
                  <Label htmlFor="hard">Hard</Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                "Generate Quiz"
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const isCorrect = currentQ.userAnswer === currentQ.correct_answer;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Quiz</h2>
            <p className="text-gray-600">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Score</div>
            <div className="text-xl font-bold">{score}/{questions.length}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-6">{currentQ.question}</h3>

          <RadioGroup
            value={currentQ.userAnswer || ""}
            onValueChange={handleAnswer}
            disabled={showAnswer}
          >
            {Object.entries(currentQ.options).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-3 mb-3">
                <RadioGroupItem
                  value={key}
                  id={`option-${key}`}
                  className={
                    showAnswer
                      ? key === currentQ.correct_answer
                        ? "text-green-600 border-green-600"
                        : key === currentQ.userAnswer && key !== currentQ.correct_answer
                        ? "text-red-600 border-red-600"
                        : ""
                      : ""
                  }
                />
                <Label
                  htmlFor={`option-${key}`}
                  className={`flex-1 cursor-pointer p-3 rounded-lg border transition-colors ${
                    showAnswer
                      ? key === currentQ.correct_answer
                        ? "bg-green-50 border-green-200 text-gray-900"
                        : key === currentQ.userAnswer && key !== currentQ.correct_answer
                        ? "bg-red-50 border-red-200 text-gray-900"
                        : "bg-gray-50 text-gray-700"
                      : "text-white hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  <span className="font-medium mr-2">{key}.</span>
                  {value}
                  {showAnswer && key === currentQ.correct_answer && (
                    <CheckCircle className="w-5 h-5 inline ml-2 text-green-600" />
                  )}
                  {showAnswer && key === currentQ.userAnswer && key !== currentQ.correct_answer && (
                    <XCircle className="w-5 h-5 inline ml-2 text-red-600" />
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {showAnswer && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Explanation:</h4>
              <p className="text-gray-700">{currentQ.explanation}</p>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          {!showAnswer ? (
            <Button
              onClick={handleSubmit}
              disabled={!currentQ.userAnswer}
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
      </Card>
    </div>
  );
};

export default QuizView;