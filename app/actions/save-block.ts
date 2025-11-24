"use server";

import { auth } from "@/app/(auth)/auth";
import {
  deleteSavedBlockByMessageId,
  getSavedBlockByMessageId,
  getSavedBlocksByChatId,
  saveBlockToNotebook,
} from "@/lib/db/queries";
import type { NewSavedBlock } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";

/**
 * Save a message to the notebook
 */
export async function saveBlockToNotebookAction({
  chatId,
  messageId,
  blockType,
  topicName,
  subtopicName,
  documentIds = [],
}: {
  chatId: string;
  messageId: string;
  blockType: "explanation" | "qa" | "summary" | "definition" | "note";
  topicName?: string;
  subtopicName?: string;
  documentIds?: string[];
}): Promise<{ success: boolean; blockId?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch the message to extract content
    // Use getMessagesByChatId from queries
    const { getMessagesByChatId } = await import("@/lib/db/queries");
    const dbMessages = await getMessagesByChatId({ id: chatId });
    const dbMessage = dbMessages.find((m) => m.id === messageId);

    if (!dbMessage) {
      return { success: false, error: "Message not found" };
    }

    // Convert DBMessage to ChatMessage format
    const message: ChatMessage = {
      id: dbMessage.id,
      role: dbMessage.role as "user" | "assistant",
      parts: (dbMessage.parts as any) || [],
      attachments: (dbMessage.attachments as any) || [],
      createdAt: new Date(dbMessage.createdAt),
    };

    // Extract text content from message
    const textParts = message.parts?.filter((p) => p.type === "text") || [];
    const content = textParts.map((p) => p.text).join("\n\n").trim();

    if (!content) {
      return { success: false, error: "Message has no text content" };
    }

    // For Q&A blocks, try to extract question and answer
    let question: string | undefined;
    let answer: string | undefined;

    if (blockType === "qa") {
      // Find the user message before this assistant message
      const messageIndex = dbMessages.findIndex((m) => m.id === messageId);
      if (messageIndex > 0) {
        const previousDbMessage = dbMessages[messageIndex - 1];
        if (previousDbMessage.role === "user") {
          const previousMessage: ChatMessage = {
            id: previousDbMessage.id,
            role: previousDbMessage.role as "user" | "assistant",
            parts: (previousDbMessage.parts as any) || [],
            attachments: (previousDbMessage.attachments as any) || [],
            createdAt: new Date(previousDbMessage.createdAt),
          };
          const userTextParts =
            previousMessage.parts?.filter((p) => p.type === "text") || [];
          question = userTextParts.map((p) => p.text).join(" ").trim();
          answer = content;
        }
      }
    }

    // Check if already saved
    const existing = await getSavedBlockByMessageId(messageId);
    if (existing) {
      return { success: true, blockId: existing.id }; // Already saved
    }

    // Create saved block
    const newBlock: NewSavedBlock = {
      chatId,
      blockType,
      content,
      question,
      answer,
      topicName: topicName || null,
      subtopicName: subtopicName || null,
      sourceMessageId: messageId,
      documentIds: documentIds || [],
      metadata: {},
    };

    const savedBlock = await saveBlockToNotebook(newBlock);

    return { success: true, blockId: savedBlock.id };
  } catch (error) {
    console.error("Failed to save block to notebook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Unsave a block from the notebook
 */
export async function unsaveBlockAction({
  messageId,
}: {
  messageId: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await deleteSavedBlockByMessageId(messageId);
    return { success: true };
  } catch (error) {
    console.error("Failed to unsave block:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all saved blocks for a chat
 */
export async function getSavedBlocksAction(
  chatId: string
): Promise<{ success: boolean; blocks?: any[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const blocks = await getSavedBlocksByChatId(chatId);
    return { success: true, blocks };
  } catch (error) {
    console.error("Failed to get saved blocks:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a message is saved
 */
export async function checkIfMessageIsSaved(
  messageId: string
): Promise<{ success: boolean; isSaved?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const block = await getSavedBlockByMessageId(messageId);
    return { success: true, isSaved: !!block };
  } catch (error) {
    console.error("Failed to check if message is saved:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

