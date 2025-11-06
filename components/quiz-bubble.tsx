"use client";

import { CheckCircle, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { QuizQuestion } from "@/lib/types/quiz";

type QuizBubbleProps = {
  data: {
    questions: QuizQuestion[];
    quizId: string;
    title: string;
  };
  onClose: () => void;
};

export function QuizBubble({ data, onClose }: QuizBubbleProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const currentQuestion = data.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === data.questions.length - 1;
  const hasAnswered = selectedAnswers[currentQuestion.id];

  const handleAnswerSelect = (answerId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: answerId,
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Calculate score
      const correctAnswers = data.questions.filter(
        (q) => selectedAnswers[q.id] === q.correct
      ).length;
      setScore(correctAnswers);
      setShowResults(true);
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setScore(0);
  };

  if (showResults) {
    return (
      <div className="flex h-full flex-col space-y-4 p-4">
        <div className="text-center flex-shrink-0">
          <div className="mb-4">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <span className="font-bold text-2xl text-blue-600">
                {score}/{data.questions.length}
              </span>
            </div>
            <h3 className="font-semibold text-gray-800 text-lg">
              Quiz Complete!
            </h3>
            <p className="text-gray-600 text-sm">
              You scored {score} out of {data.questions.length} questions
            </p>
          </div>
        </div>

        <div className="mb-4 flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto hide-scrollbar">
          {data.questions.map((question, index) => {
            const userAnswer = selectedAnswers[question.id];
            const isCorrect = userAnswer === question.correct;

            return (
              <div
                className="rounded-lg border p-3"
                key={question.id}
                style={{
                  borderColor: isCorrect ? "#10b981" : "#ef4444",
                  backgroundColor: isCorrect ? "#f0fdf4" : "#fef2f2",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  {isCorrect ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium text-sm">
                    Question {index + 1}
                  </span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{question.prompt}</p>
                {question.explanation && (
                  <p className="mt-2 text-gray-600 text-xs leading-relaxed">
                    {question.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 flex-shrink-0 pt-2 border-t border-gray-100">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
            onClick={handleRestart}
            type="button"
          >
            <RotateCcw className="h-4 w-4" />
            Retake Quiz
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      {/* Progress indicator */}
      <div className="mb-4 flex flex-shrink-0 items-center justify-between">
        <span className="text-gray-600 text-sm">
          Question {currentQuestionIndex + 1} of {data.questions.length}
        </span>
        <div className="flex gap-1">
          {data.questions.map((question, index) => (
            <div
              className={`h-2 w-2 rounded-full ${
                index <= currentQuestionIndex ? "bg-blue-500" : "bg-gray-200"
              }`}
              key={question.id}
            />
          ))}
        </div>
      </div>

      {/* Question - scrollable area (hidden scrollbar) */}
      <div className="mb-4 flex min-h-0 flex-1 flex-col overflow-y-auto hide-scrollbar">
        {/* Question */}
        <div>
          <h4 className="mb-3 font-medium text-gray-800 text-sm leading-relaxed">
            {currentQuestion.prompt}
          </h4>

          {/* Answer options */}
          <div className="space-y-2">
            {Object.entries(currentQuestion.options).map(([key, value]) => {
              const isSelected = selectedAnswers[currentQuestion.id] === key;

              return (
                <button
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  key={key}
                  onClick={() => handleAnswerSelect(key)}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 flex-shrink-0 mt-0.5 ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{key}.</span>
                      <span className="ml-1 break-words">{value}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation - fixed at bottom */}
      <div className="flex gap-2 flex-shrink-0 pt-2 border-t border-gray-100">
        <button
          className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
        <button
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          disabled={!hasAnswered}
          onClick={handleNext}
          type="button"
        >
          {isLastQuestion ? "Finish Quiz" : "Next Question"}
        </button>
      </div>
    </div>
  );
}
