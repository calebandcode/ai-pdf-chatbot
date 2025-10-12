import { createDocumentHandler } from "@/lib/artifacts/server";
import {
  getDocumentById,
  getQuestionsByQuizId,
  getQuizById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { toQuizQuestions } from "@/lib/quiz/utils";

export const quizDocumentHandler = createDocumentHandler<"quiz">({
  kind: "quiz",
  onCreateDocument: async ({ id, dataStream, session }) => {
    if (!session?.user?.id) {
      throw new ChatSDKError("unauthorized:api", "User session not found");
    }

    const documentRecord = await getDocumentById({ id });
    if (!documentRecord || !documentRecord.metadata) {
      return "";
    }
    const metadata = (documentRecord?.metadata ??
      null) as { quizId?: string; title?: string } | null;

    if (!metadata?.quizId) {
      return "";
    }

    const quiz = await getQuizById({
      id: metadata.quizId,
      userId: session.user.id,
    });

    if (!quiz) {
      throw new ChatSDKError("not_found:api", "Quiz not found");
    }

    const questions = await getQuestionsByQuizId({ quizId: quiz.id });
    const normalizedQuestions = toQuizQuestions(questions);

    dataStream.write({
      type: "data-quizInitial",
      data: {
        quizId: quiz.id,
        title: quiz.title ?? metadata.title ?? "Quiz",
        questions: normalizedQuestions,
      },
      transient: true,
    });

    return "";
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    if (!description) {
      return document.content ?? "";
    }

    try {
      const payload = JSON.parse(description);

      if (payload?.type === "quizResult" && payload?.data) {
        dataStream.write({
          type: "data-quizResult",
          data: payload.data,
          transient: true,
        });
      }
    } catch (error) {
      console.warn("Failed to process quiz update payload", error);
    }

    return document.content ?? "";
  },
});

