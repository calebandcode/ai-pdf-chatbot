"use server";

import { auth } from "@/app/(auth)/auth";
import { generateLesson } from "@/lib/ai/pdf-tutor";
import {
  createFlashcards,
  createLesson,
  getDocumentChunks,
  getLessonsByDocumentId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function generateLessonFromDocument({
  documentId,
}: {
  documentId: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get document chunks
    const chunks = await getDocumentChunks({ documentId });

    if (chunks.length === 0) {
      throw new ChatSDKError(
        "not_found:api",
        "Document not found or has no content"
      );
    }

    // Generate lesson content
    const lessonData = await generateLesson({
      chunks,
      documentTitle: `Document ${documentId.slice(0, 8)}`,
    });

    // Create lesson record
    const lesson = await createLesson({
      documentId,
      userId: session.user.id,
      title: lessonData.title,
      summary: lessonData.summary,
      keyTerms: lessonData.keyTerms,
      sourcePages: lessonData.sourcePages,
      content: lessonData.content,
    });

    // Create flashcards if any
    if (lessonData.flashcards.length > 0) {
      await createFlashcards({
        lessonId: lesson.id,
        flashcards: lessonData.flashcards,
      });
    }

    return {
      lesson,
      questions: lessonData.questions,
      flashcards: lessonData.flashcards,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError("bad_request:api", "Failed to generate lesson");
  }
}

export async function getDocumentLessons({
  documentId,
}: {
  documentId: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    const lessons = await getLessonsByDocumentId({
      documentId,
      userId: session.user.id,
    });

    return { lessons };
  } catch (error) {
    throw new ChatSDKError("bad_request:api", "Failed to fetch lessons");
  }
}
