"use server";

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 is identical and 0 is orthogonal
 * Internal helper function (not exported to avoid async requirement)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  if (a.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }
  
  return dotProduct / denominator;
}

/**
 * Find similar topics using in-memory cosine similarity
 * Used as fallback when vector DB is not available
 */
export async function findSimilarTopicsInMemory(
  newEmbedding: number[],
  existingTopics: Array<{
    topic: { topic: string; description?: string };
    embedding: number[];
  }>,
  threshold: number = 0.6
): Promise<Array<{
  topic: { topic: string; description?: string };
  similarity: number;
}>> {
  const results: Array<{
    topic: { topic: string; description?: string };
    similarity: number;
  }> = [];
  
  for (const existing of existingTopics) {
    try {
      const similarity = cosineSimilarity(newEmbedding, existing.embedding);
      if (similarity >= threshold) {
        results.push({
          topic: existing.topic,
          similarity,
        });
      }
    } catch (error) {
      // Skip topics with invalid embeddings
      console.warn("Failed to calculate similarity for topic:", error);
    }
  }
  
  // Sort by similarity (highest first)
  results.sort((a, b) => b.similarity - a.similarity);
  
  return results;
}
