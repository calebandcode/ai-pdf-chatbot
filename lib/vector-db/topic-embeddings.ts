"use server";

import { sql, eq, and, inArray } from "drizzle-orm";
import type { TopicEmbedding, NewTopicEmbedding } from "@/lib/db/schema";
import { topicEmbeddings } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type {
  TopicEmbeddingData,
  SimilarTopic,
  TopicSearchOptions,
} from "./types";

// Import db from queries (reuse existing connection)
import { db } from "@/lib/db/queries";

/**
 * Add a topic embedding to the vector database
 */
export async function addTopicEmbedding(
  data: TopicEmbeddingData
): Promise<TopicEmbedding> {
  try {
    
    // Check if topic already exists
    const existing = await db
      .select()
      .from(topicEmbeddings)
      .where(
        and(
          eq(topicEmbeddings.chatId, data.chatId),
          eq(topicEmbeddings.topicId, data.topicId)
        )
      )
      .limit(1)
      .execute();

    if (existing.length > 0) {
      // Update existing embedding
      const [updated] = await db
        .update(topicEmbeddings)
        .set({
          topicTitle: data.topicTitle,
          topicDescription: data.topicDescription,
          embedding: data.embedding,
          topicData: data.topicData,
        })
        .where(eq(topicEmbeddings.id, existing[0].id))
        .returning();
      return updated;
    }

    // Insert new embedding
    const [inserted] = await db
      .insert(topicEmbeddings)
      .values({
        chatId: data.chatId,
        documentId: data.documentId,
        topicId: data.topicId,
        topicTitle: data.topicTitle,
        topicDescription: data.topicDescription,
        embedding: data.embedding,
        topicData: data.topicData,
      } as NewTopicEmbedding)
      .returning();

    return inserted;
  } catch (error) {
    console.error("Failed to add topic embedding:", error);
    // Gracefully handle missing table (migration not run yet)
    if (
      error instanceof Error &&
      (error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("table") ||
        error.message.includes("topic_embeddings"))
    ) {
      console.warn(
        "⚠️ topic_embeddings table does not exist yet. Run migrations to enable semantic topic merging.",
        error
      );
      // Return a mock embedding object to allow fallback
      return {
        id: generateUUID(),
        chatId: data.chatId,
        documentId: data.documentId,
        topicId: data.topicId,
        topicTitle: data.topicTitle,
        topicDescription: data.topicDescription,
        embedding: null,
        topicData: data.topicData,
        createdAt: new Date(),
      } as TopicEmbedding;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add topic embedding"
    );
  }
}

/**
 * Add multiple topic embeddings in batch
 */
export async function addTopicEmbeddings(
  data: TopicEmbeddingData[]
): Promise<TopicEmbedding[]> {
  if (data.length === 0) {
    return [];
  }

  try {
    const results: TopicEmbedding[] = [];

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Use upsert-like behavior: check existing, then insert or update
      for (const item of batch) {
        const existing = await db
          .select()
          .from(topicEmbeddings)
          .where(
            and(
              eq(topicEmbeddings.chatId, item.chatId),
              eq(topicEmbeddings.topicId, item.topicId)
            )
          )
          .limit(1)
          .execute();

        if (existing.length > 0) {
          const [updated] = await db
            .update(topicEmbeddings)
            .set({
              topicTitle: item.topicTitle,
              topicDescription: item.topicDescription,
              embedding: item.embedding,
              topicData: item.topicData,
            })
            .where(eq(topicEmbeddings.id, existing[0].id))
            .returning();
          results.push(updated);
        } else {
          const [inserted] = await db
            .insert(topicEmbeddings)
            .values({
              chatId: item.chatId,
              documentId: item.documentId,
              topicId: item.topicId,
              topicTitle: item.topicTitle,
              topicDescription: item.topicDescription,
              embedding: item.embedding,
              topicData: item.topicData,
            } as NewTopicEmbedding)
            .returning();
          results.push(inserted);
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to add topic embeddings:", error);
    // Gracefully handle missing table (migration not run yet)
    if (
      error instanceof Error &&
      (error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("table") ||
        error.message.includes("topic_embeddings"))
    ) {
      console.warn(
        "⚠️ topic_embeddings table does not exist yet. Run migrations to enable semantic topic merging. Falling back to name-based merging.",
        error
      );
      // Return empty array instead of throwing - allows fallback to name-based merging
      return [];
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add topic embeddings"
    );
  }
}

/**
 * Find similar topics using cosine similarity
 * Uses pgvector's cosine distance operator
 */
export async function findSimilarTopics(
  options: TopicSearchOptions
): Promise<SimilarTopic[]> {
  try {
    const threshold = options.threshold ?? 0.6;
    const limit = options.limit ?? 10;

    // Use cosine distance: 1 - cosine_similarity
    // We want cosine_similarity >= threshold, so cosine_distance <= (1 - threshold)
    const cosineDistanceThreshold = 1 - threshold;

    // Use raw SQL directly (Drizzle query builder has issues with pgvector operators)
    // pgvector uses <=> for cosine distance, <-> for L2 distance
    // Format: Use PostgreSQL array format [1,2,3]::vector for pgvector
    // Format embedding as PostgreSQL array (not JSON string)
    // Use proper array literal format for PostgreSQL
    const vectorArrayStr = `ARRAY[${options.embedding.join(",")}]::vector`;
    const escapedChatId = options.chatId.replace(/'/g, "''");
    
    // Build exclude clause
    const excludeClause = options.excludeDocumentIds && options.excludeDocumentIds.length > 0
      ? `AND document_id != ALL(ARRAY[${options.excludeDocumentIds.map(id => `'${id.replace(/'/g, "''")}'`).join(",")}]::uuid[])`
      : "";
    
    // Use raw SQL query with pgvector cosine distance operator
    const queryStr = `
      SELECT 
        id,
        topic_id,
        topic_title,
        topic_description,
        chat_id,
        document_id,
        topic_data,
        1 - (embedding <=> ${vectorArrayStr}) as similarity
      FROM topic_embeddings
      WHERE chat_id = '${escapedChatId}'
        AND embedding <=> ${vectorArrayStr} <= ${cosineDistanceThreshold}
        ${excludeClause}
      ORDER BY embedding <=> ${vectorArrayStr} ASC
      LIMIT ${limit}
    `;
    
    const results = await db.execute(sql.raw(queryStr));
    
    // Handle different result formats from postgres driver
    const rows = (results as any).rows || (Array.isArray(results) ? results : []);
    
    return rows.map((row: any) => ({
      topicId: row.topic_id,
      topicTitle: row.topic_title,
      topicDescription: row.topic_description ?? undefined,
      similarity: typeof row.similarity === 'string' ? parseFloat(row.similarity) : (row.similarity ?? 0),
      chatId: row.chat_id,
      documentId: row.document_id,
      topicData: row.topic_data,
    }));
  } catch (error) {
    // Gracefully handle missing table, index, or syntax errors
    if (
      error instanceof Error &&
      (error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("table") ||
        error.message.includes("topic_embeddings") ||
        error.message.includes("column") ||
        error.message.includes("index") ||
        error.message.includes("syntax error") ||
        error.message.includes("42601")) // PostgreSQL syntax error code
    ) {
      console.warn(
        "⚠️ topic_embeddings query failed (table/index may not exist or syntax error). Falling back to in-memory comparison.",
        error
      );
      // Return empty array to trigger in-memory fallback
      return [];
    }
    console.error("Failed to find similar topics:", error);
    // For other errors, still return empty array to allow in-memory fallback
    // This prevents the entire merge from failing
    console.warn("Returning empty array to allow in-memory fallback");
    return [];
  }
}

/**
 * Get all topics for a chat
 */
export async function getTopicsByChatId(
  chatId: string
): Promise<TopicEmbedding[]> {
  try {
    return await db
      .select()
      .from(topicEmbeddings)
      .where(eq(topicEmbeddings.chatId, chatId))
      .execute();
  } catch (error) {
    console.error("Failed to get topics by chat ID:", error);
    // Gracefully handle missing table
    if (
      error instanceof Error &&
      (error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("table"))
    ) {
      console.warn(
        "⚠️ topic_embeddings table does not exist yet. Run migrations to enable topic retrieval.",
        error
      );
      return [];
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get topics by chat ID"
    );
  }
}

/**
 * Get topics for a specific document
 */
export async function getTopicsByDocumentId(
  documentId: string
): Promise<TopicEmbedding[]> {
  try {
    return await db
      .select()
      .from(topicEmbeddings)
      .where(eq(topicEmbeddings.documentId, documentId))
      .execute();
  } catch (error) {
    console.error("Failed to get topics by document ID:", error);
    // Gracefully handle missing table
    if (
      error instanceof Error &&
      (error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("table"))
    ) {
      return [];
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get topics by document ID"
    );
  }
}

/**
 * Delete topics for a chat (useful for cleanup)
 */
export async function deleteTopicsByChatId(
  chatId: string
): Promise<void> {
  try {
    const db = await getDb();
    await db
      .delete(topicEmbeddings)
      .where(eq(topicEmbeddings.chatId, chatId))
      .execute();
  } catch (error) {
    console.error("Failed to delete topics by chat ID:", error);
    // Gracefully handle missing table
    if (
      error instanceof Error &&
      (error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("table"))
    ) {
      return;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete topics by chat ID"
    );
  }
}

/**
 * Update a topic embedding
 */
export async function updateTopicEmbedding(
  topicId: string,
  chatId: string,
  data: Partial<Pick<TopicEmbeddingData, "embedding" | "topicTitle" | "topicDescription" | "topicData">>
): Promise<TopicEmbedding | null> {
  try {
    const db = await getDb();
    const [updated] = await db
      .update(topicEmbeddings)
      .set(data as any)
      .where(
        and(
          eq(topicEmbeddings.topicId, topicId),
          eq(topicEmbeddings.chatId, chatId)
        )
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error("Failed to update topic embedding:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update topic embedding"
    );
  }
}

