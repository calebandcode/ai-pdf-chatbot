"use client";

import { motion } from "framer-motion";
import { BookOpen, CheckCircle, Lightbulb, XCircle } from "lucide-react";
import { useState } from "react";
import { Response } from "@/components/elements/response";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatQuizQuestion } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { SessionProgress } from "./session-progress";

type QuizCardProps = {
  question: ChatQuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  onSubmit: (answer: string) => void;
  isSubmitting?: boolean;
};

export function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  onSubmit,
  isSubmitting = false,
}: QuizCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");

  console.log("QuizCard rendered with question:", question);
  console.log("QuizCard props:", {
    questionNumber,
    totalQuestions,
    isSubmitting,
  });

  // Add null checks to prevent runtime errors
  if (!question) {
    console.error("QuizCard: question is undefined", {
      question,
      questionNumber,
      totalQuestions,
    });
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="font-semibold text-lg">Quiz Question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading question...</p>
        </CardContent>
      </Card>
    );
  }

  // removed unused handleSubmit (submission handled inline)

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="w-fit max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900"
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Question Header - Simple */}
      <div className="mb-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800 text-sm">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 text-sm">
            Page {question.sourcePage || "unknown"}
          </span>
          <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800 text-sm">
            {question.difficulty || "easy"}
          </span>
        </div>

        <h3 className="mb-4 font-medium text-base text-gray-900 leading-relaxed dark:text-gray-100">
          {question.question || "Question not available"}
        </h3>
      </div>

      {/* Answer Options - Plain Text */}
      {question.type === "multiple_choice" && question.options ? (
        <div className="space-y-2">
          {Object.entries(question.options).map(([key, value]) => (
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded px-3 py-2 transition-colors",
                selectedAnswer === key
                  ? "bg-blue-50 text-blue-900"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/70",
                isSubmitting && "cursor-not-allowed opacity-50"
              )}
              key={key}
            >
              <input
                checked={selectedAnswer === key}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                disabled={isSubmitting}
                name={`question-${question.id}`}
                onChange={() => {
                  setSelectedAnswer(key);
                  setTimeout(() => {
                    if (!isSubmitting) {
                      onSubmit(key);
                    }
                  }, 500);
                }}
                type="radio"
                value={key}
              />
              <div className="flex-1">
                <span className="font-medium text-sm dark:text-gray-100">
                  {key}.
                </span>
                <span className="ml-2 text-sm">{value}</span>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
          <p className="text-gray-600 text-sm dark:text-gray-300">
            This question type is not yet supported. Please contact support.
          </p>
          <p className="mt-2 text-gray-500 text-xs dark:text-gray-400">
            Question type: {question.type || "unknown"} | Has options:{" "}
            {question.options ? "yes" : "no"}
          </p>
        </div>
      )}
    </motion.div>
  );
}

type QuizResultProps = {
  question: ChatQuizQuestion;
  userAnswer: string;
  isCorrect: boolean;
  explanation: string;
  onNext?: () => void;
  onFinish?: () => void;
  isLastQuestion?: boolean;
  sessionStats?: {
    questionsAnswered: number;
    totalQuestions: number;
    correctAnswers: number;
    startTime: Date;
  };
};

export function QuizResult({
  question,
  userAnswer,
  isCorrect,
  explanation,
  onNext,
  onFinish,
  isLastQuestion = false,
  sessionStats,
}: QuizResultProps) {
  // Add null checks to prevent runtime errors
  if (!question) {
    console.error("QuizResult: question is undefined", {
      question,
      userAnswer,
      isCorrect,
    });
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="font-semibold text-lg">Quiz Result</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading quiz result...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader className="pb-4">
        <div className="mb-2 flex items-center gap-3">
          {isCorrect ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <CardTitle className="font-semibold text-lg">
            {isCorrect ? "Correct!" : "Incorrect"}
          </CardTitle>
        </div>
        <p className="text-base leading-relaxed">
          {question.question || "Question not available"}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="rounded-lg bg-muted/20 p-3">
            <p className="mb-1 font-medium text-muted-foreground text-sm">
              Your Answer:
            </p>
            <p className="text-sm">
              {question.type === "multiple_choice" && question.options
                ? question.options[userAnswer] ||
                  userAnswer ||
                  "No answer provided"
                : userAnswer || "No answer provided"}
            </p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-1 font-medium text-green-800 text-sm">
              Correct Answer:
            </p>
            <p className="text-green-700 text-sm">
              {question.type === "multiple_choice" && question.options
                ? question.options[question.correctAnswer] ||
                  question.correctAnswer ||
                  "Answer not available"
                : question.correctAnswer || "Answer not available"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-2 font-medium text-blue-800 text-sm">
            Teacher's Explanation:
          </p>
          <div className="text-blue-700 text-sm leading-relaxed">
            <Response isStreaming={false} speed={20}>
              {explanation || "No explanation available"}
            </Response>
          </div>

          {!isCorrect && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="mb-2 font-medium text-orange-800 text-sm">
                <Lightbulb className="mr-1 h-4 w-4 text-yellow-500" /> Study
                Tip:
              </p>
              <p className="text-orange-700 text-sm">
                This concept appears on page {question.sourcePage || "unknown"}.
                Would you like me to explain this topic in more detail?
              </p>
              <Button
                className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={() => {
                  // Trigger study artifact mode
                  console.log("Study more requested for:", question.question);
                }}
                size="sm"
                variant="outline"
              >
                <BookOpen className="mr-1 h-4 w-4" /> Study This Topic More
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <BookOpen className="h-4 w-4" />
            <span>Source: Page {question.sourcePage}</span>
          </div>

          <div className="flex gap-2">
            {isLastQuestion ? (
              <Button onClick={onFinish} variant="default">
                🎉 Finish Quiz
              </Button>
            ) : (
              <Button onClick={onNext} variant="default">
                ➡️ Next Question
              </Button>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Quiz Progress</span>
            <span className="font-medium">
              {isLastQuestion ? "Complete!" : "Keep going!"}
            </span>
          </div>
        </div>
      </CardContent>

      {/* Session Progress */}
      {sessionStats && (
        <div className="mt-4">
          <SessionProgress
            correctAnswers={sessionStats.correctAnswers}
            questionsAnswered={sessionStats.questionsAnswered}
            startTime={sessionStats.startTime}
            totalQuestions={sessionStats.totalQuestions}
          />
        </div>
      )}
    </Card>
  );
}
