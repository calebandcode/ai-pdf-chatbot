"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Brain, CheckCircle, RotateCcw, X, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
};

type QuizData = {
  questions: QuizQuestion[];
  summary: string;
  keyConcepts: string[];
  source: string;
  generatedAt: string;
};

type QuizFromTextModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  source?: string;
};

export function QuizFromTextModal({
  isOpen,
  onClose,
  selectedText,
  source,
}: QuizFromTextModalProps) {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: number]: string;
  }>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const generateQuiz = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/quiz-from-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: selectedText,
          source: source || "Unknown",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate quiz");
      }

      const result = await response.json();
      setQuizData(result.data);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setShowResults(false);
      setScore(0);
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Failed to generate quiz. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (quizData?.questions.length || 0) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Calculate score
      let correctCount = 0;
      quizData?.questions.forEach((question, index) => {
        if (selectedAnswers[index] === question.correctAnswer) {
          correctCount++;
        }
      });
      setScore(correctCount);
      setShowResults(true);
    }
  };

  const handleRestart = () => {
    setQuizData(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setScore(0);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": {
        return "bg-green-100 text-green-800";
      }
      case "medium": {
        return "bg-yellow-100 text-yellow-800";
      }
      case "hard": {
        return "bg-red-100 text-red-800";
      }
      default: {
        return "bg-gray-100 text-gray-800";
      }
    }
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) {
      return "text-green-600";
    }
    if (percentage >= 60) {
      return "text-yellow-600";
    }
    return "text-red-600";
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          animate={{ scale: 1, opacity: 1 }}
          className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
          exit={{ scale: 0.9, opacity: 0 }}
          initial={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-gray-200 border-b p-4 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold text-xl">Quiz from Text</h2>
              {quizData && (
                <Badge variant="outline">
                  {currentQuestionIndex + 1} of {quizData.questions.length}
                </Badge>
              )}
            </div>
            <Button onClick={onClose} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4">
            {quizData ? (
              showResults ? (
                <div className="py-8 text-center">
                  <div className="mb-6">
                    <div
                      className={`mb-2 font-bold text-4xl ${getScoreColor(score, quizData.questions.length)}`}
                    >
                      {score}/{quizData.questions.length}
                    </div>
                    <p className="text-gray-600 text-lg dark:text-gray-400">
                      {score === quizData.questions.length
                        ? "Perfect! 🎉"
                        : score >= quizData.questions.length * 0.8
                          ? "Great job! 👏"
                          : score >= quizData.questions.length * 0.6
                            ? "Good effort! 💪"
                            : "Keep studying! 📚"}
                    </p>
                  </div>

                  <div className="mb-6 space-y-4">
                    {quizData.questions.map((question, index) => {
                      const isCorrect =
                        selectedAnswers[index] === question.correctAnswer;
                      return (
                        <Card
                          className={`${isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
                          key={index}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {isCorrect ? (
                                <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
                              )}
                              <div className="flex-1">
                                <p className="mb-2 font-medium">
                                  {question.question}
                                </p>
                                <p className="text-gray-600 text-sm dark:text-gray-400">
                                  <strong>Correct answer:</strong>{" "}
                                  {question.correctAnswer}
                                </p>
                                <p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
                                  <strong>Explanation:</strong>{" "}
                                  {question.explanation}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handleRestart}
                      variant="outline"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      New Quiz
                    </Button>
                    <Button className="flex-1" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {quizData.questions[currentQuestionIndex] && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            Question {currentQuestionIndex + 1}
                          </CardTitle>
                          <Badge
                            className={getDifficultyColor(
                              quizData.questions[currentQuestionIndex]
                                .difficulty
                            )}
                          >
                            {
                              quizData.questions[currentQuestionIndex]
                                .difficulty
                            }
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4 text-gray-800 dark:text-gray-200">
                          {quizData.questions[currentQuestionIndex].question}
                        </p>

                        <div className="mb-6 space-y-2">
                          {quizData.questions[currentQuestionIndex].options.map(
                            (option, optionIndex) => (
                              <Button
                                className="h-auto w-full justify-start p-3 text-left"
                                key={optionIndex}
                                onClick={() =>
                                  handleAnswerSelect(
                                    currentQuestionIndex,
                                    option
                                  )
                                }
                                variant={
                                  selectedAnswers[currentQuestionIndex] ===
                                  option
                                    ? "default"
                                    : "outline"
                                }
                              >
                                <span className="mr-2 font-medium">
                                  {String.fromCharCode(65 + optionIndex)}.
                                </span>
                                {option}
                              </Button>
                            )
                          )}
                        </div>

                        <div className="flex justify-between">
                          <Button
                            className="ml-auto"
                            disabled={!selectedAnswers[currentQuestionIndex]}
                            onClick={handleNextQuestion}
                          >
                            {currentQuestionIndex ===
                            quizData.questions.length - 1
                              ? "Finish Quiz"
                              : "Next Question"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )
            ) : (
              <div className="py-8 text-center">
                <div className="mb-4">
                  <Brain className="mx-auto mb-4 h-16 w-16 text-purple-600" />
                  <h3 className="mb-2 font-semibold text-lg">
                    Generate Quiz Questions
                  </h3>
                  <p className="mb-4 text-gray-600 dark:text-gray-400">
                    Create a quiz based on your selected text
                  </p>
                  <div className="rounded-lg bg-gray-50 p-3 text-left text-sm dark:bg-gray-700">
                    <strong>Selected text:</strong> "{selectedText}"
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={isLoading}
                  onClick={generateQuiz}
                >
                  {isLoading ? "Generating Quiz..." : "Generate Quiz Questions"}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
