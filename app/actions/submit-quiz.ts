"use server";

import { auth } from "@/app/(auth)/auth";
import {
  createQuizAttempt,
  getQuestionsByQuizId,
  getQuizById,
  saveQuizAnswers,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { QuizResult } from "@/lib/types";

type SubmitQuizInput = {
  quizId: string;
  answers: Array<{
    questionId: string;
    chosenOptionId: string | null;
  }>;
};

export async function submitQuizAttempt({
  quizId,
  answers,
}: SubmitQuizInput): Promise<QuizResult> {
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

  const questions = await getQuestionsByQuizId({ quizId });

  if (questions.length === 0) {
    throw new ChatSDKError(
      "bad_request:api",
      "Cannot submit quiz without any questions"
    );
  }

  const answersByQuestion = new Map(
    answers.map((entry) => [entry.questionId, entry.chosenOptionId])
  );

  const evaluatedAnswers = questions.map((question) => {
    const chosenOptionId = answersByQuestion.get(question.id) ?? null;
    const isCorrect =
      chosenOptionId !== null && chosenOptionId === question.correct;

    return {
      questionId: question.id,
      chosenOptionId,
      isCorrect,
    };
  });

  const total = evaluatedAnswers.length;
  const correctCount = evaluatedAnswers.filter(
    (entry) => entry.isCorrect
  ).length;
  const score =
    total === 0 ? 0 : Math.round((correctCount / total) * 100);

  const attempt = await createQuizAttempt({
    quizId,
    userId: session.user.id,
    startedAt: new Date(),
    submittedAt: new Date(),
    scorePct: score,
  });

  await saveQuizAnswers({
    answers: evaluatedAnswers.map((entry) => ({
      attemptId: attempt.id,
      questionId: entry.questionId,
      chosenOptionId: entry.chosenOptionId,
      isCorrect: entry.isCorrect,
      feedback: null,
    })),
  });

  return {
    quizId,
    total,
    correctCount,
    score,
    answers: evaluatedAnswers,
  };
}
