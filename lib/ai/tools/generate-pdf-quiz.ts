import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { generateChatQuestions } from "@/lib/ai/pdf-tutor";
import {
  createDocumentRecord,
  createQuizRecord,
  getDocumentChunks,
  saveQuizQuestions,
} from "@/lib/db/queries";
import { type DocumentChunk } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage, DataPart } from "@/lib/types";

type GeneratePdfQuizProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const generatePdfQuiz = ({
  session,
  dataStream,
}: GeneratePdfQuizProps) =>
  tool({
    description: "Generate a quiz artifact from uploaded PDF documents",
    inputSchema: z.object({
      documentIds: z
        .array(z.string())
        .describe("Array of document IDs to generate quiz from"),
      title: z.string().describe("Title for the quiz"),
      difficulty: z
        .enum(["easy", "medium", "hard"])
        .describe("Difficulty level of the quiz"),
      questionCount: z
        .number()
        .min(1)
        .max(20)
        .describe("Number of questions to generate"),
    }),
    execute: async ({ documentIds, title, difficulty, questionCount }) => {
      if (!session?.user?.id) {
        throw new ChatSDKError("unauthorized:api", "User session not found");
      }

      try {
        // Get chunks from all documents
        const allChunks: DocumentChunk[] = [];
        for (const documentId of documentIds) {
          const chunks = await getDocumentChunks({ documentId });
          allChunks.push(...chunks);
        }

        if (allChunks.length === 0) {
          throw new ChatSDKError("not_found:api", "No document content found");
        }

        // Generate questions using the AI service
        const questions = await generateChatQuestions({
          chunks: allChunks,
        });

        // Create quiz record
        const quiz = await createQuizRecord({
          userId: session.user.id,
          title,
          topic: undefined,
          difficulty: difficulty === "medium" ? "easy" : difficulty,
        });

        // Create questions records
        const questionsWithQuizId = questions.map((q) => ({
          prompt: q.question,
          correct: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty === "medium" ? "easy" : q.difficulty,
          options: q.options || {},
          rationales: {},
          sourceRefs: { page: q.sourcePage },
        }));

        await saveQuizQuestions({
          quizId: quiz.id,
          questions: questionsWithQuizId,
        });

        // Create document artifact for the quiz
        const documentRecord = await createDocumentRecord({
          userId: session.user.id,
          title: `Quiz: ${title}`,
          blobUrl: "", // No file for generated quizzes
        });

        // Send data stream event to open quiz artifact
        // TODO: Fix data stream type issue
        /*
        dataStream.write({
          type: "data-quizGenerated",
          data: {
            quizId: quiz.id,
            title: quiz.title,
            questionCount: questions.length,
            documentId: documentRecord.id,
          },
          transient: true,
        } as DataPart);
        */

        return `Quiz "${title}" created with ${questions.length} questions. The quiz is now available in the Document Bank.`;
      } catch (error) {
        if (error instanceof ChatSDKError) {
          throw error;
        }
        throw new ChatSDKError("bad_request:api", "Failed to generate quiz");
      }
    },
  });
