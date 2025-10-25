"use client";

import { useEffect, useRef } from "react";
import { useQuizArtifact } from "@/hooks/use-quiz-artifact";

type QuizArtifactTriggerProps = {
  quizData: {
    quizId: string;
    title?: string;
    questions?: Array<{
      id: string;
      prompt: string;
      options: Array<{ id: string; label: string; text: string }>;
      correct: string;
      explanation: string;
      sourcePage: number;
      difficulty: string;
    }>;
    totalQuestions?: number;
    // Legacy single question format
    question?: string;
    options?: Record<string, string>;
    questionNumber?: number;
    difficulty?: string;
    sourcePage?: number;
    correctAnswer?: string;
  };
  messageId: string;
  partIndex: number;
};

export function QuizArtifactTrigger({ quizData }: QuizArtifactTriggerProps) {
  const { triggerQuizArtifact } = useQuizArtifact();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!triggeredRef.current) {
      triggeredRef.current = true;
      triggerQuizArtifact(quizData);
    }
  }, [triggerQuizArtifact, quizData]);

  return (
    <div className="my-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        <p className="font-medium text-blue-700 text-sm">
          Opening quiz in sidebar...
        </p>
      </div>
    </div>
  );
}
