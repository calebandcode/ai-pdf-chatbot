"use server";

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getChatById, getChatContext } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { id } = await params;
    if (!id) {
      return new ChatSDKError("bad_request:chat").toResponse();
    }

    let chatRecord;
    try {
      chatRecord = await getChatById({ id });
    } catch (error) {
      console.error("❌ Failed to get chat by id:", error);
      return NextResponse.json(
        { error: "Failed to fetch chat", context: null },
        { status: 500 }
      );
    }

    if (!chatRecord || chatRecord.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const context = await getChatContext({ chatId: id }).catch((error) => {
      console.error("❌ Failed to get chat context:", error);
      // Return null instead of throwing - allows Edit Mode to work even if context doesn't exist yet
      return null;
    });
    
    return NextResponse.json({ context });
  } catch (error) {
    console.error("❌ Error in GET /api/chat/[id]/context:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat context", context: null },
      { status: 500 }
    );
  }
}
