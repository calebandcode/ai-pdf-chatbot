"use server";

import { auth } from "@/app/(auth)/auth";
import {
  getQuestionsByQuizId,
  getQuizById,
  saveDocument,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { QuizQuestion } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { toQuizQuestions } from "@/lib/quiz/utils";

type OpenQuizInput = {
  quizId: string;
  title: string;
};

type OpenQuizResult = {
  documentId: string;
  title: string;
  quiz: {
    quizId: string;
    title: string;
    questions: QuizQuestion[];
  };
};

export async function openQuiz({
  quizId,
  title,
}: OpenQuizInput): Promise<OpenQuizResult> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  const quiz = await getQuizById({
    id: quizId,
    userId: session.user.id,
  });

  if (!quiz) {
    throw new ChatSDKError("not_found:api", "Quiz not found");
  }

  const questions = await getQuestionsByQuizId({ quizId: quiz.id });

  if (questions.length === 0) {
    throw new ChatSDKError(
      "bad_request:api",
      "This quiz does not have any questions yet."
    );
  }

  const normalizedQuestions: QuizQuestion[] = toQuizQuestions(questions);

  const documentId = generateUUID();

  await saveDocument({
    id: documentId,
    title: quiz.title ?? title,
    kind: "quiz",
    content: "",
    userId: session.user.id,
    metadata: {
      quizId: quiz.id,
      title: quiz.title ?? title,
    },
  });

  return {
    documentId,
    title: quiz.title ?? title,
    quiz: {
      quizId: quiz.id,
      title: quiz.title ?? title,
      questions: normalizedQuestions,
    },
  };
}

