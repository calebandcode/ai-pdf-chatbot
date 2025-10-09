import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { docChunks, documents } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";

const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  throw new ChatSDKError(
    "bad_request:database",
    "POSTGRES_URL environment variable is required for retrieval"
  );
}

const client = postgres(POSTGRES_URL);
const db = drizzle(client);

export type RetrievedChunk = {
  documentId: string;
  page: number;
  content: string;
};

/**
 * TODO: Support vector search by computing a query embedding and ordering by cosine similarity.
 */
export async function retrieveTopK({
  userId,
  docIds,
  k = 40,
}: {
  userId: string;
  docIds: string[];
  k?: number;
}): Promise<RetrievedChunk[]> {
  if (!userId) {
    return [];
  }

  const targetDocIds = docIds?.filter(Boolean) ?? [];

  const limit = Math.max(k ?? 40, 30);

  const conditions = [eq(documents.userId, userId)] as Array<
    ReturnType<typeof eq>
  >;

  if (targetDocIds.length > 0) {
    conditions.push(inArray(documents.id, targetDocIds));
  }

  const rows = await db
    .select({
      documentId: docChunks.documentId,
      page: docChunks.page,
      content: docChunks.content,
    })
    .from(docChunks)
    .innerJoin(documents, eq(documents.id, docChunks.documentId))
    .where(and(...conditions))
    .orderBy(
      desc(sql<number>`char_length(${docChunks.content})`),
      docChunks.documentId,
      docChunks.page
    )
    .limit(limit);

  return rows;
}
