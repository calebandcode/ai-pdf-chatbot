"use server";

import { auth } from "@/app/(auth)/auth";
import {
  generateChatQuestions,
  generateContextualResponse,
  gradeAnswer,
} from "@/lib/ai/pdf-tutor";
import {
  createChatQuiz,
  getChatQuizById,
  getDocumentChunks,
  saveMessages,
  updateChatQuiz,
} from "@/lib/db/queries";
import type { ChatQuizQuestion } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";

export async function startChatQuiz({
  chatId,
  documentIds,
  title = "Interactive Quiz",
}: {
  chatId: string;
  documentIds: string[];
  title?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get chunks from all documents
    const allChunks: Awaited<ReturnType<typeof getDocumentChunks>> = [] as any;
    for (const documentId of documentIds) {
      const chunks = await getDocumentChunks({ documentId });
      allChunks.push(...chunks);
    }

    if (allChunks.length === 0) {
      throw new ChatSDKError("not_found:api", "No document content found");
    }

    // Generate questions
    const questions = await generateChatQuestions({
      chunks: allChunks,
    });

    // Create chat quiz
    const chatQuiz = await createChatQuiz({
      chatId,
      userId: session.user.id,
      title,
      questions,
    });

    // Post the first question as an assistant message so it appears inline
    const firstQuestion = questions[0] || null;
    if (firstQuestion) {
      await saveMessages({
        messages: [
          {
            id: crypto.randomUUID(),
            chatId,
            role: "assistant",
            parts: [
              {
                type: "text",
                text: `Quiz Drill • Q1 (page ${firstQuestion.sourcePage}): ${firstQuestion.question}`,
              },
            ],
            attachments: [],
            createdAt: new Date(),
            // mark as quiz drill context using metadata if schema allows; omitted if not supported
          },
        ],
      });
    }

    return {
      chatQuiz,
      firstQuestion,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError("bad_request:api", "Failed to start chat quiz");
  }
}

export async function submitChatQuizAnswer({
  quizId,
  questionId,
  answer,
  documentIds,
}: {
  quizId: string;
  questionId: string;
  answer: string;
  documentIds: string[];
}) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get the chat quiz
    const chatQuiz = await getChatQuizById({
      id: quizId,
      userId: session.user.id,
    });

    if (!chatQuiz) {
      throw new ChatSDKError("not_found:api", "Chat quiz not found");
    }

    // Find the question
    const question = chatQuiz.questions.find(
      (q: ChatQuizQuestion) => q.id === questionId
    );
    if (!question) {
      throw new ChatSDKError("not_found:api", "Question not found");
    }

    // Get document chunks for context
    const allChunks: Awaited<ReturnType<typeof getDocumentChunks>> = [] as any;
    for (const documentId of documentIds) {
      const chunks = await getDocumentChunks({ documentId });
      allChunks.push(...chunks);
    }

    // Grade the answer
    const gradeResult = await gradeAnswer({
      question,
      studentAnswer: answer,
    });

    // Update quiz with the answer
    const updatedAnswers: Record<string, string | null> = {
      ...(chatQuiz.answers as Record<string, string | null>),
      [questionId]: answer,
    };

    const nextQuestionIndex = chatQuiz.currentQuestionIndex + 1;
    const isCompleted = nextQuestionIndex >= chatQuiz.questions.length;

    await updateChatQuiz({
      id: quizId,
      userId: session.user.id,
      updates: {
        answers: updatedAnswers,
        currentQuestionIndex: nextQuestionIndex,
        isCompleted,
      },
    });

    const nextQuestion = isCompleted
      ? null
      : chatQuiz.questions[nextQuestionIndex];

    return {
      gradeResult,
      nextQuestion,
      isCompleted,
      progress: {
        current: nextQuestionIndex,
        total: chatQuiz.questions.length,
      },
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError("bad_request:api", "Failed to submit answer");
  }
}

export async function askDocumentQuestion({
  question,
  documentIds,
}: {
  question: string;
  documentIds: string[];
}) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get chunks from all documents
    const allChunks = [];
    for (const documentId of documentIds) {
      const chunks = await getDocumentChunks({ documentId });
      allChunks.push(...chunks);
    }

    if (allChunks.length === 0) {
      throw new ChatSDKError("not_found:api", "No document content found");
    }

    // Generate contextual response
    const response = await generateContextualResponse({
      question,
      chunks: allChunks,
    });

    return response;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError("bad_request:api", "Failed to answer question");
  }
}
