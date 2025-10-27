"use server";

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
import { generateUUID } from "@/lib/utils";
import { processContent } from "./process-content";

export type ContentType = "text" | "link" | "youtube";

export interface ProcessAndCreateNotebookParams {
  contentType: ContentType;
  content: string;
  title?: string;
}

export interface ProcessedNotebookResult {
  success: boolean;
  data?: {
    documentId: string;
    chatId: string;
    title: string;
    summary: string;
    suggestedActions?: string[];
  };
  error?: string;
}

export async function processAndCreateNotebook(
  params: ProcessAndCreateNotebookParams
): Promise<ProcessedNotebookResult> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    const { contentType, content, title } = params;

    console.log(
      "📝 Starting",
      contentType,
      "processing for user:",
      session.user.id
    );

    // Process the content using our existing processors
    const processResult = await processContent({
      contentType,
      content,
      title,
    });

    if (!processResult.success || !processResult.data) {
      throw new Error(processResult.error || "Failed to process content");
    }

    const processedContent = processResult.data;

    // Create a document record (similar to PDF processing)
    const documentRecord = await createDocumentRecord({
      userId: session.user.id,
      title: processedContent.title,
      blobUrl: `content://${contentType}/${Date.now()}`, // Placeholder URL for non-PDF content
    });

    console.log("📝 Created document record:", documentRecord.id);

    // Create document chunks and embeddings (like PDF processing)
    console.log("📝 Starting content chunking for:", documentRecord.title);

    // Convert processed content to page-like format for chunking
    const pages = [
      {
        page: 1,
        text: processedContent.content,
      },
    ];

    console.time("chunkPages");
    const chunks = chunkPages(pages);
    console.timeEnd("chunkPages");
    console.log("📝 Created chunks:", chunks.length, "chunks");

    console.time("embedChunks");
    const embedded = await embedChunks(chunks);
    console.timeEnd("embedChunks");
    console.log("📝 Generated embeddings for chunks");

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
    console.log("📝 Saved document chunks to database");

    // Generate document summary using AI (like PDF processing)
    console.log("📝 Retrieving document chunks for AI processing...");
    const documentChunks = await getDocumentChunks({
      documentId: documentRecord.id,
    });
    console.log(
      "📝 Retrieved document chunks for AI processing:",
      documentChunks.length
    );

    console.time("generateDocumentSummary");
    const summaryResult = await generateDocumentSummary({
      chunks: documentChunks,
      title: documentRecord.title,
    });
    console.timeEnd("generateDocumentSummary");
    console.log("📝 Generated summary:", summaryResult.summary);

    // Save the summary to database
    console.time("createDocumentSummary");
    await createDocumentSummary({
      documentId: documentRecord.id,
      summary: summaryResult.summary,
      mainTopics: summaryResult.mainTopics,
      suggestedActions: summaryResult.suggestedActions,
    });
    console.timeEnd("createDocumentSummary");
    console.log("📝 Saved document summary to database");

    // Create a chat entry (similar to PDF processing)
    const chatId = generateUUID();

    // Generate a title for the chat based on the content
    const chatTitle = await generateTitleFromUserMessage({
      message: {
        id: generateUUID(),
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: processedContent.title,
          },
        ],
      },
    });

    // Save the chat to database
    await saveChat({
      id: chatId,
      userId: session.user.id,
      title: chatTitle,
      visibility: "private",
    });

    console.log("📝 Created chat:", chatId, "with title:", chatTitle);

    // Create initial AI message (like PDF processing)
    console.log("🤖 Creating initial AI message:", {
      id: chatId,
      documentTitle: documentRecord.title,
      summaryLength: summaryResult.summary.length,
      suggestedActionsCount: summaryResult.suggestedActions.length,
    });

    const initialAiMessage = {
      id: generateUUID(),
      chatId,
      role: "assistant" as const,
      parts: [
        {
          type: "text" as const,
          text: `Done • analyzed ${contentType} content`,
        },
        {
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
        },
      ],
      attachments: [],
      createdAt: new Date(),
    };

    console.time("saveMessages(initialAiMessage)");
    await saveMessages({
      messages: [initialAiMessage],
    });
    console.timeEnd("saveMessages(initialAiMessage)");
    console.log("✅ Initial AI message saved to database successfully");

    return {
      success: true,
      data: {
        documentId: documentRecord.id,
        chatId,
        title: processedContent.title,
        summary:
          processedContent.metadata?.summary ||
          "Content processed successfully",
        suggestedActions: [
          "Ask me about any topic",
          "Take a quiz on this content",
          "Explore related concepts",
        ],
      },
    };
  } catch (error) {
    console.error(`📝 Error processing ${params.contentType}:`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process content",
    };
  }
}
