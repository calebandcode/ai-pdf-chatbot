"use server";

import { auth } from "@/app/(auth)/auth";
import { getDocumentRecordsByIds } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const MAX_REQUESTED_IDS = 32;

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");

  if (!idsParam) {
    return Response.json({ documents: [] }, { status: 200 });
  }

  const parsedIds = idsParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (parsedIds.length === 0) {
    return Response.json({ documents: [] }, { status: 200 });
  }

  const uniqueIds = Array.from(new Set(parsedIds)).slice(0, MAX_REQUESTED_IDS);

  try {
    const documents = await getDocumentRecordsByIds({
      ids: uniqueIds,
      userId: session.user.id,
    });
    return Response.json({ documents }, { status: 200 });
  } catch (error) {
    console.error("Failed to load documents for ids:", uniqueIds, error);
    return new ChatSDKError("bad_request:api").toResponse();
  }
}
