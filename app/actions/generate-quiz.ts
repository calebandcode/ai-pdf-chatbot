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

function buildPlaceholderQuestion({
  chunk,
  index,
  difficulty,
}: {
  chunk: { documentId: string; page: number; content: string };
  index: number;
  difficulty: QuizDifficulty;
}) {
  const snippet = chunk.content.slice(0, 220).trim();
  const prompt =
    snippet.length > 0
      ? `Based on page ${chunk.page}, what best summarizes this passage?\n\n"${snippet}${snippet.length >= 220 ? "…" : ""}"`
      : `Review page ${chunk.page} and choose the best summary.`;

  const options = [
    {
      id: `option-${index}-a`,
      label: "A",
      text: "Highlights the main idea accurately.",
    },
    {
      id: `option-${index}-b`,
      label: "B",
      text: "Focuses on a minor detail instead of the main point.",
    },
    {
      id: `option-${index}-c`,
      label: "C",
      text: "Contradicts the author's viewpoint.",
    },
    {
      id: `option-${index}-d`,
      label: "D",
      text: "Introduces information not found in the passage.",
    },
  ];

  return {
    prompt,
    difficulty,
    options,
    correct: options[0].id,
    explanation:
      "Option A best reflects the central idea presented in the selected passage.",
    rationales: [],
    sourceRefs: [
      {
        documentId: chunk.documentId,
        page: chunk.page,
      },
    ],
  };
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

  const selectedChunks =
    questionCount >= chunks.length
      ? chunks
      : chunks.slice(0, questionCount);

  if (selectedChunks.length > 0) {
    const questionsPayload = selectedChunks.map((chunk, index) =>
      buildPlaceholderQuestion({ chunk, index, difficulty })
    );

    await saveQuizQuestions({
      quizId: quiz.id,
      questions: questionsPayload,
    });
  }

  return {
    quizId: quiz.id,
    count: questionCount,
    title: quiz.title ?? createQuizTitle(difficulty),
  };
}
