"use server";

import { put } from "@vercel/blob";
import { auth } from "@/app/(auth)/auth";
import { generateTitleFromUserMessage } from "@/app/(chat)/actions";
import { generateDocumentSummary } from "@/lib/ai/pdf-tutor";
import {
  createDocumentRecord,
  createDocumentSummary,
  getChatById,
  getChatContext,
  getDocumentChunks,
  saveChat,
  saveDocumentChunks,
  saveMessages,
  upsertChatContext,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { chunkPages } from "@/lib/ingest/chunk";
import { embedChunks } from "@/lib/ingest/embed";
import { extractPdfPages } from "@/lib/ingest/pdf";
import { ensureVectorIndex } from "@/lib/ingest/vector";
import { generateUUID } from "@/lib/utils";
import { mergeSourceIntoContext } from "@/lib/ai/context-merge";

type UploadResult = {
  documentId: string;
  title: string;
  blobUrl: string;
  chunksInserted: number;
  summary?: string;
  suggestedActions?: string[];
  pageCount?: number;
  chatId?: string;
  deltaMessage?: string;
};

type UploadAndIngestOptions = {
  chatId?: string;
};

const PDF_EXTENSION_REGEX = /\.pdf$/i;

function sanitizeTitle(filename: string) {
  return filename.replace(PDF_EXTENSION_REGEX, "");
}

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}

export async function uploadAndIngest(
  formData: FormData,
  options?: UploadAndIngestOptions
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  const files = formData.getAll("files").filter(isFile);
  console.log(
    "uploadAndIngest: received files:",
    files.map((f) => ({
      name: (f as File).name,
      type: (f as File).type,
      size: (f as File).size,
    }))
  );

  if (files.length === 0) {
    throw new ChatSDKError("bad_request:api", "No files provided");
  }

  const results: UploadResult[] = [];
  if (options?.chatId) {
    const chatRecord = await getChatById({ id: options.chatId });
    if (!chatRecord || chatRecord.userId !== session.user.id) {
      throw new ChatSDKError(
        "forbidden:chat",
        "You do not have access to this chat"
      );
    }
  }

  for (const file of files) {
    const startedAtMs = Date.now();
    console.log("ðŸ“„ Starting processing for file:", file.name);

    if (file.type !== "application/pdf") {
      throw new ChatSDKError(
        "bad_request:api",
        `Unsupported file type: ${file.type}`
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("ðŸ“„ File buffer created, size:", buffer.length);

    // For development, we'll skip blob storage and use a placeholder URL
    // In production, you'll need to configure Vercel Blob storage
    let blobUrl: string;

    try {
      const blob = await put(`documents/${file.name}`, buffer, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      });
      blobUrl = blob.url;
    } catch (error) {
      console.warn(
        "Vercel Blob storage not configured, using placeholder URL:",
        error
      );
      // Use a placeholder URL for development
      blobUrl = `placeholder://documents/${file.name}`;
    }

    const title = sanitizeTitle(file.name);

    try {
      console.log("ðŸ“„ Creating document record for:", title);
      const documentRecord = await createDocumentRecord({
        userId: session.user.id,
        title,
        blobUrl,
      });
      console.log("ðŸ“„ Document record created:", documentRecord.id);

      console.log("ðŸ“„ Starting PDF processing for:", title);
      console.time("extractPdfPages");
      const pages = await extractPdfPages(buffer);
      console.timeEnd("extractPdfPages");
      console.log("ðŸ“„ Extracted pages:", pages.length, "pages");

      // Log first page content to verify PDF parsing is working
      if (pages.length > 0) {
        console.log(
          `ðŸ“„ First page content preview: ${pages[0].text.slice(0, 200)}...`
        );
      }

      console.time("chunkPages");
      const chunks = chunkPages(pages);
      console.timeEnd("chunkPages");
      console.log("ðŸ“„ Created chunks:", chunks.length, "chunks");

      console.time("embedChunks");
      const embedded = await embedChunks(chunks);
      console.timeEnd("embedChunks");
      console.log("ðŸ“„ Generated embeddings for chunks");

      console.time("saveDocumentChunks");
      await saveDocumentChunks({
        documentId: documentRecord.id,
        chunks: embedded.map((chunk) => ({
          page: chunk.page ?? 1,
          content: chunk.content,
          embedding: chunk.embedding,
          tokens: chunk.tokens ?? null,
        })),
      });
      console.timeEnd("saveDocumentChunks");
      console.log("ðŸ“„ Saved document chunks to database");

      // Generate document summary and suggested actions
      console.log("ðŸ“„ Retrieving document chunks for AI processing...");
      const documentChunks = await getDocumentChunks({
        documentId: documentRecord.id,
      });
      console.log(
        "ðŸ“„ Retrieved document chunks for AI processing:",
        documentChunks.length
      );

      // Log sample content being sent to AI
      if (documentChunks.length > 0) {
        console.log(
          `ðŸ“„ Sample content for AI: ${documentChunks[0].content.slice(0, 200)}...`
        );
      }

      console.time("generateDocumentSummary");
      const summaryResult = await generateDocumentSummary({
        chunks: documentChunks,
        title: documentRecord.title,
      });
      console.timeEnd("generateDocumentSummary");
      console.log("ðŸ“„ Generated summary:", summaryResult.summary);
      const elapsedMs = Date.now() - startedAtMs;

      // Save the summary to database
      console.time("createDocumentSummary");
      await createDocumentSummary({
        documentId: documentRecord.id,
        summary: summaryResult.summary,
        mainTopics: summaryResult.mainTopics,
        suggestedActions: summaryResult.suggestedActions,
      });
      console.timeEnd("createDocumentSummary");
      console.log("dY", "Saved document summary to database");

            const targetChatId = options?.chatId ?? generateUUID();
      const initialMessage =
        options?.chatId !== undefined
          ? null
          : {
              id: generateUUID(),
              role: "user" as const,
              parts: [
                {
                  type: "text" as const,
                  text: `PDF uploaded: ${documentRecord.title}`,
                },
              ],
              createdAt: new Date(),
            };

      if (!options?.chatId && initialMessage) {
        console.time("generateTitleFromUserMessage");
        const chatTitle = await generateTitleFromUserMessage({
          message: initialMessage,
        });
        console.timeEnd("generateTitleFromUserMessage");
        console.log("dY", "Generated chat title:", chatTitle);

        console.time("saveChat");
        await saveChat({
          id: targetChatId,
          userId: session.user.id,
          title: chatTitle,
          visibility: "private",
        });
        console.timeEnd("saveChat");
        console.log("dY", "Saved chat to database:", targetChatId);
      }

      const sourceEntry = {
        documentId: documentRecord.id,
        title: documentRecord.title,
        summary: summaryResult.summary,
        mainTopics: summaryResult.mainTopics,
      };

      // Get existing context (gracefully handle missing table)
      const existingContext = await getChatContext({ chatId: targetChatId }).catch(() => null);
      
      // Option B: Just append source - no expensive merging
      if (existingContext) {
        // Check if this source already exists
        const existingSourceIds = existingContext?.sources?.map(s => s.documentId) ?? [];
        if (existingSourceIds.includes(documentRecord.id)) {
          console.warn(`Source ${documentRecord.id} already exists in chat ${targetChatId}`);
          // Continue anyway, but don't add duplicate to context
        } else {
          // Just append source - instant, no AI calls
          const updatedSources = [
            ...(existingContext.sources || []),
            sourceEntry
          ];

          // Save context (gracefully handles missing table)
          try {
            await upsertChatContext({
              chatId: targetChatId,
              sources: updatedSources,
              globalSummary: "",  // Not used in Option B
              globalTopics: [],    // Not used in Option B
            });
          } catch (error) {
            console.warn("Failed to save chat context (table may not exist):", error);
          }
        }
      } else {
        // New chat - create initial context (just the source, no merging)
        try {
          await upsertChatContext({
            chatId: targetChatId,
            sources: [sourceEntry],
            globalSummary: "",  // Not used in Option B
            globalTopics: [],   // Not used in Option B
          });
        } catch (error) {
          console.warn("Failed to save chat context (table may not exist):", error);
        }
      }

      // Always create PDFUploadMessage part to show document card
      // This allows users to see document structure and topics even when adding to existing chat
      const pdfUploadPart = {
        type: "data-pdfUpload" as const,
        data: {
          documentTitle: documentRecord.title,
          pageCount: summaryResult.pageCount,
          summary: summaryResult.summary,
          mainTopics: summaryResult.mainTopics,
          suggestedActions: summaryResult.suggestedActions,
          documentId: documentRecord.id,
          chatId: targetChatId,
        },
      };

      const aiMessageId = generateUUID();
      // When adding to existing chat, don't include delta message in text part (show as toast instead)
      // For new chats, keep the status message
      const assistantMessage = {
        id: aiMessageId,
        chatId: targetChatId,
        role: "assistant" as const,
        parts: options?.chatId !== undefined
          ? [
              // Only include PDFUploadMessage part when adding to existing chat
              // Delta message will be shown as toast notification
              pdfUploadPart,
            ]
          : [
              // For new chats, include status message
              {
                type: "text" as const,
                text: `Done • analyzed ${summaryResult.pageCount} pages in ${formatDurationMs(
                  elapsedMs
                )}`,
              },
              // Always include PDFUploadMessage part for document card display
              pdfUploadPart,
            ],
        attachments: [],
        createdAt: new Date(),
      };

      console.log("dY- Creating AI message:", {
        id: aiMessageId,
        chatId: targetChatId,
        documentTitle: documentRecord.title,
        summaryLength: summaryResult.summary.length,
        suggestedActionsCount: summaryResult.suggestedActions.length,
      });

      await saveMessages({
        messages: [assistantMessage],
      });
      results.push({
        documentId: documentRecord.id,
        title: documentRecord.title,
        blobUrl: documentRecord.blobUrl,
        chunksInserted: embedded.length,
        summary: summaryResult.summary,
        suggestedActions: summaryResult.suggestedActions,
        pageCount: summaryResult.pageCount,
        chatId: targetChatId,
        // Include delta message when adding to existing chat for toast notification
        deltaMessage: options?.chatId !== undefined ? messageContext.deltaMessage : undefined,
      });
    } catch (dbError) {
      console.error(
        "âŒ Database operations failed during PDF upload:",
        dbError
      );
      console.error("âŒ Error details:", {
        name: dbError instanceof Error ? dbError.name : "Unknown",
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      throw new Error(
        `PDF upload failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`
      );
    }
  }

  console.log("uploadAndIngest: ensuring vector index...");
  await ensureVectorIndex();
  console.log("uploadAndIngest: vector index ensured");

  console.log(
    "uploadAndIngest: returning results:",
    results.map((r) => ({
      documentId: r.documentId,
      chatId: r.chatId,
      title: r.title,
      pageCount: r.pageCount,
    }))
  );
  return { documents: results };
}



