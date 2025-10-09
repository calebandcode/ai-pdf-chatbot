"use server";

import { auth } from "@/app/(auth)/auth";
import {
  createQuizRecord,
  saveQuizQuestions,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { retrieveTopK } from "@/lib/retrieval";
import type { QuizDifficulty, QuizOfferSummary } from "@/lib/types";

type GenerateQuizInput = {
  documentIds: string[];
  difficulty: QuizDifficulty;
};

type GenerateQuizResult = QuizOfferSummary;

function createQuizTitle(difficulty: QuizDifficulty) {
  if (difficulty === "easy") {
    return "Quick Warm-up Quiz";
  }

  return "Deep Dive Challenge";
}

export async function generateQuiz({
  documentIds,
  difficulty,
}: GenerateQuizInput): Promise<GenerateQuizResult> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  const userId = session.user.id;
  const docIds = documentIds.filter(Boolean);

  if (docIds.length === 0) {
    throw new ChatSDKError(
      "bad_request:api",
      "No documents provided for quiz generation"
    );
  }

  const chunks = await retrieveTopK({
    userId,
    docIds,
    k: 40,
  });

  const questionCount =
    difficulty === "easy"
      ? Math.max(5, Math.min(10, Math.floor(chunks.length / 3) || 5))
      : Math.max(8, Math.min(12, Math.floor(chunks.length / 2) || 8));

  const quiz = await createQuizRecord({
    userId,
    title: createQuizTitle(difficulty),
    topic: undefined,
    difficulty,
  });

  // TODO: Populate real questions; for v1 just register placeholders.
  if (questionCount > 0) {
    await saveQuizQuestions({
      quizId: quiz.id,
      questions: Array.from({ length: questionCount }).map((_, index) => ({
        prompt: `Placeholder question ${index + 1}`,
        difficulty,
        options: [],
        correct: "TBD",
        explanation: "Detailed quiz explanations are coming soon.",
        rationales: [],
        sourceRefs: [],
      })),
    });
  }

  return {
    quizId: quiz.id,
    count: questionCount,
  };
}
