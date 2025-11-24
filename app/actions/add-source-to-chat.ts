"use server";

import { auth } from "@/app/(auth)/auth";
import { generateDocumentSummary } from "@/lib/ai/pdf-tutor";
import {
  createDocumentRecord,
  createDocumentSummary,
  getChatById,
  getChatContext,
  getDocumentChunks,
  saveDocumentChunks,
  saveMessages,
  upsertChatContext,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { chunkPages } from "@/lib/ingest/chunk";
import { embedChunks } from "@/lib/ingest/embed";
import { ensureVectorIndex } from "@/lib/ingest/vector";
import { generateUUID } from "@/lib/utils";
import { processContent, type ContentType } from "./process-content";
import { mergeSourceIntoContext } from "@/lib/ai/context-merge";

type SupportedContentType = Exclude<ContentType, "pdf">;

type AddSourceParams = {
  chatId: string;
  contentType: SupportedContentType;
  content: string;
  title?: string;
};

export async function addSourceToChat({
  chatId,
  contentType,
  content,
  title,
}: AddSourceParams) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  const chatRecord = await getChatById({ id: chatId });
  if (!chatRecord || chatRecord.userId !== session.user.id) {
    throw new ChatSDKError(
      "forbidden:chat",
      "You do not have access to this chat"
    );
  }

  const processed = await processContent({
    contentType,
    content,
    title,
  });

  if (!processed.success || !processed.data) {
    throw new ChatSDKError(
      "bad_request:api",
      processed.error || "Unable to process content"
    );
  }

  const processedContent = processed.data;

  const documentRecord = await createDocumentRecord({
    userId: session.user.id,
    title: processedContent.title,
    blobUrl: `content://${contentType}/${Date.now()}`,
  });

  const pages = [
    {
      page: 1,
      text: processedContent.content,
    },
  ];

  const chunks = chunkPages(pages);
  const embedded = await embedChunks(chunks);

  await saveDocumentChunks({
    documentId: documentRecord.id,
    chunks: embedded.map((chunk) => ({
      page: chunk.page ?? 1,
      content: chunk.content,
      embedding: chunk.embedding,
      tokens: chunk.tokens ?? null,
    })),
  });

  const documentChunks = await getDocumentChunks({
    documentId: documentRecord.id,
  });

  const summaryResult = await generateDocumentSummary({
    chunks: documentChunks,
    title: documentRecord.title,
  });

  await createDocumentSummary({
    documentId: documentRecord.id,
    summary: summaryResult.summary,
    mainTopics: summaryResult.mainTopics,
    suggestedActions: summaryResult.suggestedActions,
  });

  const sourceEntry = {
    documentId: documentRecord.id,
    title: documentRecord.title,
    summary: summaryResult.summary,
    mainTopics: summaryResult.mainTopics,
  };

  // Get existing context (gracefully handle missing table)
  const existingContext = await getChatContext({ chatId }).catch(() => null);
  
  // Check if this source already exists
  const existingSourceIds = existingContext?.sources?.map(s => s.documentId) ?? [];
  if (existingSourceIds.includes(documentRecord.id)) {
    throw new ChatSDKError(
      "bad_request:api",
      `"${documentRecord.title}" is already in this chat.`
    );
  }

  // Option B: Just append source - no expensive merging
  // Additional sources are hidden from display but used for context
  const updatedSources = [
    ...(existingContext?.sources || []),
    sourceEntry
  ];

  // Save context (gracefully handles missing table)
  try {
    await upsertChatContext({
      chatId,
      sources: updatedSources,
      globalSummary: "",  // Not used in Option B
      globalTopics: [],    // Not used in Option B
    });
  } catch (error) {
    // Log but don't fail if context table doesn't exist
    console.warn("Failed to save chat context (table may not exist):", error);
  }

  // Always create PDFUploadMessage part to show document card
  // This allows users to see document structure and topics for link/text sources
  const pdfUploadPart = {
    type: "data-pdfUpload" as const,
    data: {
      documentTitle: documentRecord.title,
      pageCount: 1, // Non-PDF content is treated as single "page"
      summary: summaryResult.summary,
      mainTopics: summaryResult.mainTopics,
      suggestedActions: summaryResult.suggestedActions,
      documentId: documentRecord.id,
      chatId,
    },
  };

  // Don't include delta message in text part - it will be shown as toast notification
  const assistantMessage = {
    id: generateUUID(),
    chatId,
    role: "assistant" as const,
    parts: [
      // Only include PDFUploadMessage part - delta message will be shown as toast
      pdfUploadPart,
    ],
    attachments: [],
    createdAt: new Date(),
  };

  await saveMessages({
    messages: [assistantMessage],
  });

  await ensureVectorIndex();

  return {
    documentId: documentRecord.id,
    title: documentRecord.title,
    summary: summaryResult.summary,
    mainTopics: summaryResult.mainTopics,
    suggestedActions: summaryResult.suggestedActions,
    // Return delta message for toast notification
    deltaMessage: mergedContext.deltaMessage,
  };
}
