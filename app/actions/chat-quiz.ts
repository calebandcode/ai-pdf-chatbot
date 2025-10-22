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
    console.log("Generating questions from chunks:", allChunks.length);
    const questions = await generateChatQuestions({
      chunks: allChunks,
    });
    console.log("Generated questions:", questions);

    // Create chat quiz
    const chatQuiz = await createChatQuiz({
      chatId,
      userId: session.user.id,
      title,
      questions,
    });

    // Post the first question as an interactive quiz card
    const firstQuestion = questions[0] || null;
    console.log("First question for quiz card:", {
      firstQuestion,
      hasQuestion: !!firstQuestion,
      questionText: firstQuestion?.question,
      questionType: firstQuestion?.type,
      questionOptions: firstQuestion?.options,
      totalQuestions: questions.length,
    });

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
                text: `🎯 **Quiz Drill Started!**\n\nI've prepared ${questions.length} questions based on your document. Let's begin with the first question:`,
              },
              {
                type: "tool-call",
                toolName: "askQuizQuestion",
                toolCallId: crypto.randomUUID(),
                args: {
                  question: firstQuestion.question,
                  options: firstQuestion.options || {},
                  questionNumber: 1,
                  totalQuestions: questions.length,
                  quizId: chatQuiz.id,
                  difficulty: firstQuestion.difficulty || "easy",
                  sourcePage: firstQuestion.sourcePage || 1,
                },
              },
            ],
            attachments: [],
            createdAt: new Date(),
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

    console.log("Found question for grading:", {
      questionId,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      sourcePage: question.sourcePage,
      type: question.type,
    });

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

    // Post the result as a message
    const currentQuestion = chatQuiz.questions[chatQuiz.currentQuestionIndex];
    console.log("Creating quiz result message:", {
      currentQuestion: currentQuestion?.question,
      currentQuestionIndex: chatQuiz.currentQuestionIndex,
      totalQuestions: chatQuiz.questions.length,
      isCompleted,
      gradeResult: {
        isCorrect: gradeResult.isCorrect,
        explanation: `${gradeResult.explanation?.substring(0, 100) || "No explanation"}...`,
      },
    });
    await saveMessages({
      messages: [
        {
          id: crypto.randomUUID(),
          chatId: chatQuiz.chatId,
          role: "assistant",
          parts: [
            {
              type: "data-quiz-result",
              data: {
                question: currentQuestion || {
                  id: questionId,
                  question: "Question not available",
                  type: "multiple_choice",
                  options: {},
                  correctAnswer: "",
                  explanation: "No explanation available",
                  sourcePage: 1,
                  difficulty: "easy",
                },
                userAnswer: answer,
                isCorrect: gradeResult.isCorrect,
                explanation: gradeResult.explanation,
                isLastQuestion: isCompleted,
                quizId,
              },
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    // If not completed, post the next question
    if (nextQuestion && !isCompleted) {
      await saveMessages({
        messages: [
          {
            id: crypto.randomUUID(),
            chatId: chatQuiz.chatId,
            role: "assistant",
            parts: [
              {
                type: "data-quiz-question",
                data: {
                  question: nextQuestion,
                  questionNumber: nextQuestionIndex + 1,
                  totalQuestions: chatQuiz.questions.length,
                  quizId,
                },
              },
            ],
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

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
    const allChunks: Awaited<ReturnType<typeof getDocumentChunks>> = [] as any;
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
