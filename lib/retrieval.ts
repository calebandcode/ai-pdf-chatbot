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
 * Retrieve relevant chunks using vector similarity search
 */
export async function retrieveTopK({
  userId,
  docIds,
  query,
  k = 40,
}: {
  userId: string;
  docIds: string[];
  query?: string;
  k?: number;
}): Promise<RetrievedChunk[]> {
  if (!userId) {
    return [];
  }

  const targetDocIds = docIds?.filter(Boolean) ?? [];
  const limit = Math.max(k ?? 40, 30);

  try {
    const conditions = [eq(documents.userId, userId)] as Array<
      ReturnType<typeof eq>
    >;

    if (targetDocIds.length > 0) {
      conditions.push(inArray(documents.id, targetDocIds));
    }

    let rows: RetrievedChunk[] = [];

    // If we have a query, try vector similarity search
    if (query && query.trim()) {
      try {
        // Import embedding function dynamically to avoid circular deps
        const { embedChunks } = await import("@/lib/ingest/embed");
        const queryChunks = await embedChunks([{ content: query.trim() }]);

        if (queryChunks.length > 0 && queryChunks[0].embedding) {
          const queryEmbedding = queryChunks[0].embedding;

          // Vector similarity search using cosine distance
          rows = await db
            .select({
              documentId: docChunks.documentId,
              page: docChunks.page,
              content: docChunks.content,
            })
            .from(docChunks)
            .innerJoin(documents, eq(documents.id, docChunks.documentId))
            .where(and(...conditions))
            .orderBy(
              sql<number>`1 - (${docChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}) DESC`
            )
            .limit(limit);
        }
      } catch (vectorError) {
        console.warn(
          "Vector search failed, falling back to text search:",
          vectorError
        );
      }
    }

    // Fallback to text-based search if vector search failed or no query
    if (rows.length === 0) {
      rows = await db
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
    }

    return rows;
  } catch (error) {
    console.warn("Database retrieval failed, returning empty results:", error);
    return [];
  }
}
