"use server";

import { put } from "@vercel/blob";
import { auth } from "@/app/(auth)/auth";
import { generateTitleFromUserMessage } from "@/app/(chat)/actions";
import { generateDocumentSummary } from "@/lib/ai/pdf-tutor";
import {
  createDocumentRecord,
  createDocumentSummary,
  getDocumentChunks,
  saveChat,
  saveDocumentChunks,
  saveMessages,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { chunkPages } from "@/lib/ingest/chunk";
import { embedChunks } from "@/lib/ingest/embed";
import { extractPdfPages } from "@/lib/ingest/pdf";
import { ensureVectorIndex } from "@/lib/ingest/vector";
import { generateUUID } from "@/lib/utils";

type UploadResult = {
  documentId: string;
  title: string;
  blobUrl: string;
  chunksInserted: number;
  summary?: string;
  suggestedActions?: string[];
  pageCount?: number;
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

export async function uploadAndIngest(formData: FormData) {
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

  for (const file of files) {
    const startedAtMs = Date.now();
    console.log("📄 Starting processing for file:", file.name);

    if (file.type !== "application/pdf") {
      throw new ChatSDKError(
        "bad_request:api",
        `Unsupported file type: ${file.type}`
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("📄 File buffer created, size:", buffer.length);

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
      console.log("📄 Creating document record for:", title);
      const documentRecord = await createDocumentRecord({
        userId: session.user.id,
        title,
        blobUrl,
      });
      console.log("📄 Document record created:", documentRecord.id);

      console.log("📄 Starting PDF processing for:", title);
      console.time("extractPdfPages");
      const pages = await extractPdfPages(buffer);
      console.timeEnd("extractPdfPages");
      console.log("📄 Extracted pages:", pages.length, "pages");

      // Log first page content to verify PDF parsing is working
      if (pages.length > 0) {
        console.log(
          `📄 First page content preview: ${pages[0].text.slice(0, 200)}...`
        );
      }

      console.time("chunkPages");
      const chunks = chunkPages(pages);
      console.timeEnd("chunkPages");
      console.log("📄 Created chunks:", chunks.length, "chunks");

      console.time("embedChunks");
      const embedded = await embedChunks(chunks);
      console.timeEnd("embedChunks");
      console.log("📄 Generated embeddings for chunks");

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
      console.log("📄 Saved document chunks to database");

      // Generate document summary and suggested actions
      console.log("📄 Retrieving document chunks for AI processing...");
      const documentChunks = await getDocumentChunks({
        documentId: documentRecord.id,
      });
      console.log(
        "📄 Retrieved document chunks for AI processing:",
        documentChunks.length
      );

      // Log sample content being sent to AI
      if (documentChunks.length > 0) {
        console.log(
          `📄 Sample content for AI: ${documentChunks[0].content.slice(0, 200)}...`
        );
      }

      console.time("generateDocumentSummary");
      const summaryResult = await generateDocumentSummary({
        chunks: documentChunks,
        title: documentRecord.title,
      });
      console.timeEnd("generateDocumentSummary");
      console.log("📄 Generated summary:", summaryResult.summary);
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
      console.log("📄 Saved document summary to database");

      // Create a chat entry for this PDF upload
      const chatId = generateUUID();
      const initialMessage = {
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

      // Generate a title for the chat based on the PDF
      console.time("generateTitleFromUserMessage");
      const chatTitle = await generateTitleFromUserMessage({
        message: initialMessage,
      });
      console.timeEnd("generateTitleFromUserMessage");
      console.log("📄 Generated chat title:", chatTitle);

      // Save the chat to database
      console.time("saveChat");
      await saveChat({
        id: chatId,
        userId: session.user.id,
        title: chatTitle,
        visibility: "private",
      });
      console.timeEnd("saveChat");
      console.log("📄 Saved chat to database:", chatId);

      // Create and save the initial AI message with interactive PDF upload data
      const aiMessageId = generateUUID();
      const initialAiMessage = {
        id: aiMessageId,
        chatId,
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: `Done • analyzed ${summaryResult.pageCount} pages in ${formatDurationMs(elapsedMs)}`,
          },
          {
            type: "data-pdfUpload" as const,
            data: {
              documentTitle: documentRecord.title,
              pageCount: summaryResult.pageCount,
              summary: summaryResult.summary,
              mainTopics: summaryResult.mainTopics,
              suggestedActions: summaryResult.suggestedActions,
              documentId: documentRecord.id,
              chatId,
            },
          },
        ],
        attachments: [],
        createdAt: new Date(),
      };

      console.log("🤖 Creating initial AI message:", {
        id: aiMessageId,
        chatId,
        documentTitle: documentRecord.title,
        summaryLength: summaryResult.summary.length,
        suggestedActionsCount: summaryResult.suggestedActions.length,
      });

      // Save the initial AI message to the database
      try {
        console.time("saveMessages(initialAiMessage)");
        await saveMessages({
          messages: [initialAiMessage],
        });
        console.timeEnd("saveMessages(initialAiMessage)");
        console.log("✅ Initial AI message saved to database successfully");
      } catch (dbError) {
        console.error(
          "❌ Failed to save initial AI message to database:",
          dbError
        );
        throw new Error(
          `Database save failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`
        );
      }

      results.push({
        documentId: documentRecord.id,
        title: documentRecord.title,
        blobUrl: documentRecord.blobUrl,
        chunksInserted: embedded.length,
        summary: summaryResult.summary,
        suggestedActions: summaryResult.suggestedActions,
        pageCount: summaryResult.pageCount,
        chatId,
      });
    } catch (dbError) {
      console.error(
        "❌ Database operations failed during PDF upload:",
        dbError
      );
      console.error("❌ Error details:", {
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
