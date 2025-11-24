import "server-only";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
// Use the same db instance as topic-embeddings.ts (which works!)
import { db } from "@/lib/db/queries";
import { docChunks, documents } from "@/lib/db/schema";

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
    const conditions = [eq(documents.userId, userId)] as ReturnType<
      typeof eq
    >[];

    if (targetDocIds.length > 0) {
      conditions.push(inArray(documents.id, targetDocIds));
    }

    let rows: RetrievedChunk[] = [];

    // If we have a query, try vector similarity search
    if (query?.trim()) {
      try {
        // Import embedding function dynamically to avoid circular deps
        const { embedChunks } = await import("@/lib/ingest/embed");

        let queryEmbedding: number[] | null = null;
        try {
          const queryChunks = await embedChunks([{ content: query.trim() }]);
          if (queryChunks.length > 0 && queryChunks[0].embedding) {
            queryEmbedding = queryChunks[0].embedding;
          }
        } catch (embedError) {
          console.warn("Failed to generate query embedding:", embedError);
          // Continue to text search fallback
        }

        if (queryEmbedding) {
          // Format vector array as PostgreSQL array literal
          // CRITICAL: Ensure all embedding values are valid numbers and properly formatted
          const cleanEmbedding = queryEmbedding.map((v) => {
            if (typeof v !== "number" || !Number.isFinite(v)) {
              return 0;
            }
            // Use toFixed to avoid scientific notation, then Number.parseFloat to remove trailing zeros
            return Number.parseFloat(v.toFixed(10));
          });

          // Get document IDs using Drizzle (matches working pattern)
          let validDocIds: string[] = [];

          try {
            if (targetDocIds.length > 0) {
              const docResults = await db
                .select({ id: documents.id })
                .from(documents)
                .where(
                  and(
                    eq(documents.userId, userId),
                    inArray(documents.id, targetDocIds)
                  )
                )
                .execute();
              validDocIds = docResults.map((row) => String(row.id));
            } else {
              const docResults = await db
                .select({ id: documents.id })
                .from(documents)
                .where(eq(documents.userId, userId))
                .execute();
              validDocIds = docResults.map((row) => String(row.id));
            }
          } catch (docQueryError) {
            console.warn("Failed to fetch document IDs:", docQueryError);
            // Continue to text search fallback
            validDocIds = [];
          }

          // Vector search: Use in-memory cosine similarity (no raw SQL)
          if (validDocIds.length > 0) {
            try {
              // Step 1: Get all chunks for the documents using Drizzle (safe, no raw SQL)
              // Use isNotNull instead of sql template to avoid potential parsing issues
              const allChunks = await db
                .select({
                  documentId: docChunks.documentId,
                  page: docChunks.page,
                  content: docChunks.content,
                  embedding: docChunks.embedding,
                })
                .from(docChunks)
                .where(
                  and(
                    inArray(docChunks.documentId, validDocIds),
                    isNotNull(docChunks.embedding)
                  )
                )
                .execute();

              // Step 2: Calculate cosine similarity in memory and sort
              // This completely avoids any PostgreSQL vector array parsing issues
              if (allChunks.length > 0 && allChunks[0].embedding) {
                // Calculate cosine similarity for each chunk
                const chunksWithSimilarity = allChunks
                  .map((chunk) => {
                    if (
                      !chunk.embedding ||
                      chunk.embedding.length !== cleanEmbedding.length
                    ) {
                      return null;
                    }
                    // Cosine similarity: dot product / (norm(a) * norm(b))
                    let dotProduct = 0;
                    let normA = 0;
                    let normB = 0;
                    for (let i = 0; i < cleanEmbedding.length; i++) {
                      dotProduct += cleanEmbedding[i] * chunk.embedding[i];
                      normA += cleanEmbedding[i] ** 2;
                      normB += chunk.embedding[i] ** 2;
                    }
                    const similarity =
                      dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
                    return {
                      ...chunk,
                      similarity: Number.isNaN(similarity) ? 0 : similarity,
                    };
                  })
                  .filter(
                    (chunk): chunk is NonNullable<typeof chunk> =>
                      chunk !== null
                  )
                  .sort((a, b) => b.similarity - a.similarity) // Sort by similarity descending
                  .slice(0, limit)
                  .map(({ similarity, ...chunk }) => chunk); // Remove similarity from result

                rows = chunksWithSimilarity;
                console.log(
                  `✅ Vector search succeeded (in-memory): found ${rows.length} chunks`
                );
              } else {
                console.log(
                  "⚠️ No chunks with embeddings found for vector search"
                );
                rows = [];
              }
            } catch (chunkQueryError: any) {
              // If chunk query fails, log the error and fall back to text search
              console.warn(
                "Failed to fetch chunks for vector search:",
                chunkQueryError instanceof Error
                  ? chunkQueryError.message
                  : chunkQueryError
              );

              // Check if it's a SQL syntax error
              if (
                chunkQueryError?.code === "42601" ||
                chunkQueryError?.message?.includes("syntax error")
              ) {
                console.warn(
                  "SQL syntax error detected in chunk query - this shouldn't happen with in-memory calculation"
                );
                console.warn("Error details:", {
                  code: chunkQueryError.code,
                  message: chunkQueryError.message,
                });
              }
              rows = [];
            }
          } else {
            console.log("⚠️ No valid document IDs found for vector search");
            rows = [];
          }
        } else {
          console.log(
            "⚠️ Failed to generate query embedding, falling back to text search"
          );
          rows = [];
        }
      } catch (vectorError: any) {
        // Log detailed error for debugging
        console.warn(
          "Vector search failed, falling back to text search:",
          vectorError instanceof Error ? vectorError.message : vectorError
        );

        // Log additional details for SQL syntax errors
        if (
          vectorError?.code === "42601" ||
          vectorError?.message?.includes("syntax error")
        ) {
          console.warn(
            "SQL syntax error (42601) detected in outer catch block"
          );
          console.warn("Error details:", {
            code: vectorError.code,
            message: vectorError.message,
            stack: vectorError instanceof Error ? vectorError.stack : undefined,
          });
          console.warn(
            "This error should not occur with in-memory cosine similarity. Please check the error stack trace above."
          );
        }
        rows = [];
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
