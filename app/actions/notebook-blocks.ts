"use server";

import { auth } from "@/app/(auth)/auth";
import {
  getNotebookBlocksByChatId,
  getNotebookBlockById,
  saveNotebookBlocks,
  updateNotebookBlock,
  deleteNotebookBlock,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { NotebookBlock, NewNotebookBlock } from "@/lib/db/schema";
import type { PartialBlock } from "@blocknote/core";

export async function loadNotebookBlocksAction({
  chatId,
}: {
  chatId: string;
}): Promise<NotebookBlock[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    const blocks = await getNotebookBlocksByChatId({ chatId });
    return blocks;
  } catch (error) {
    // Check if it's a table doesn't exist error (42P01)
    const isTableMissingError = 
      error instanceof Error && 
      "code" in error && 
      (error as { code?: string }).code === "42P01";
    
    if (isTableMissingError) {
      console.warn("Notebook blocks table does not exist yet, returning empty array");
      return [];
    }
    
    console.error("Failed to load notebook blocks:", error);
    // Return empty array instead of throwing to allow graceful fallback
    return [];
  }
}

export async function saveNotebookBlocksAction({
  chatId,
  blocks,
}: {
  chatId: string;
  blocks: PartialBlock[];
}): Promise<NotebookBlock[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Convert BlockNote blocks to database format
    const dbBlocks: NewNotebookBlock[] = blocks.map((block, index) => ({
      chatId,
      blockType: block.type || "paragraph",
      blockOrder: index,
      blockData: {
        type: block.type || "paragraph",
        props: (block as any).props || {},
        content: (block as any).content || [],
      },
      metadata: {
        pinned: false,
        tags: [],
        linkedBlockIds: [],
        collapsed: false,
        parentBlockId: null,
        ...((block as any).props?.metadata || {}),
      },
    }));

    const savedBlocks = await saveNotebookBlocks({
      blocks: dbBlocks,
      chatId,
    });

    return savedBlocks;
  } catch (error) {
    console.error("Failed to save notebook blocks:", error);
    throw new ChatSDKError("bad_request:api", "Failed to save notebook blocks");
  }
}

export async function updateNotebookBlockAction({
  blockId,
  updates,
}: {
  blockId: string;
  updates: Partial<NewNotebookBlock>;
}): Promise<NotebookBlock> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    const updatedBlock = await updateNotebookBlock({ blockId, updates });
    return updatedBlock;
  } catch (error) {
    console.error("Failed to update notebook block:", error);
    throw new ChatSDKError("bad_request:api", "Failed to update notebook block");
  }
}

export async function deleteNotebookBlockAction({
  blockId,
}: {
  blockId: string;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    await deleteNotebookBlock({ blockId });
  } catch (error) {
    console.error("Failed to delete notebook block:", error);
    throw new ChatSDKError("bad_request:api", "Failed to delete notebook block");
  }
}

export async function toggleBlockPinAction({
  blockId,
  pinned,
}: {
  blockId: string;
  pinned: boolean;
}): Promise<NotebookBlock> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get the current block to preserve existing metadata
    const currentBlock = await getNotebookBlockById({ blockId });
    
    if (!currentBlock) {
      throw new ChatSDKError("not_found:api", "Block not found");
    }
    
    const updatedBlock = await updateNotebookBlock({
      blockId,
      updates: {
        metadata: {
          ...(currentBlock.metadata || {}),
          pinned,
        },
      },
    });

    return updatedBlock;
  } catch (error) {
    console.error("Failed to toggle block pin:", error);
    throw new ChatSDKError("bad_request:api", "Failed to toggle block pin");
  }
}

