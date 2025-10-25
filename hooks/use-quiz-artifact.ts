"use client";

import { useCallback } from "react";
import { useArtifact } from "@/hooks/use-artifact";

export function useQuizArtifact() {
  const { setArtifact, setMetadata } = useArtifact();

  const triggerQuizArtifact = useCallback(
    (
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
      },
      _documentId?: string
    ) => {
      try {
        // Handle both new multi-question format and legacy single-question format
        let questions: Array<{
          id: string;
          prompt: string;
          options: Array<{ id: string; label: string; text: string }>;
          correct: string;
          explanation: string;
          sourcePage: number;
          difficulty: string;
        }>;
        let title: string;

        if (quizData.questions && quizData.questions.length > 0) {
          // New format: multiple questions provided
          questions = quizData.questions;
          title =
            quizData.title ||
            `Quiz: ${questions[0].prompt.substring(0, 50)}...`;
        } else {
          // Legacy format: single question
          questions = [
            {
              id: `${quizData.quizId}-q1`,
              prompt: quizData.question || "Question not available",
              options: Object.entries(quizData.options || {}).map(
                ([label, text]) => ({
                  id: label,
                  label,
                  text: text as string,
                })
              ),
              correct: quizData.correctAnswer || "",
              explanation: "",
              sourcePage: quizData.sourcePage || 1,
              difficulty: quizData.difficulty || "easy",
            },
          ];
          title = `Quiz: ${quizData.question?.substring(0, 50) || "Question"}...`;
        }

        const metadata = {
          quizId: quizData.quizId,
          title,
          questions,
          answers: Object.fromEntries(
            questions.map((question) => [question.id, null])
          ),
          activeQuestionIndex: 0,
          startedAt: Date.now(),
          durationSeconds: 300, // 5 minutes
          submitted: false,
          result: null,
        };

        // Use a special document ID that won't trigger document fetching
        const artifactDocumentId = `quiz-self-contained-${quizData.quizId}`;

        setArtifact({
          documentId: artifactDocumentId,
          kind: "quiz",
          content: "",
          title: metadata.title,
          isVisible: true,
          status: "idle",
          boundingBox: {
            top: 0,
            left: 0,
            width: 400,
            height: 600,
          },
        });

        setTimeout(() => {
          setMetadata(metadata);
        }, 0);
      } catch (error) {
        console.error("Failed to trigger quiz artifact:", error);
      }
    },
    [setArtifact, setMetadata]
  );

  return { triggerQuizArtifact };
}
