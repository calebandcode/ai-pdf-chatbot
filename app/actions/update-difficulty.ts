"use server";

import { auth } from "@/app/(auth)/auth";
import { updateChatDifficultyLevelById } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

export async function updateDifficultyLevelAction({
  chatId,
  difficultyLevel,
}: {
  chatId: string;
  difficultyLevel: "age12" | "age15" | "university";
}) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify chat belongs to user (done in updateChatDifficultyLevelById via getChatById check)
    await updateChatDifficultyLevelById({
      chatId,
      difficultyLevel,
    });

    revalidatePath(`/chat/${chatId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update difficulty level:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update difficulty level",
    };
  }
}



