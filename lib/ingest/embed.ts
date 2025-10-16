// lib/ingest/embed.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Server-side key (do not expose via NEXT_PUBLIC_*)
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.warn(
    "⚠️ GOOGLE_GENERATIVE_AI_API_KEY is missing — embeddings will use mock vectors."
  );
}

const genAI = new GoogleGenerativeAI(apiKey || "");
// Use the embeddings model via getGenerativeModel
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

function sanitizeEmbedding(embedding: any): number[] {
  if (!embedding) {
    return new Array(1536).fill(0);
  }
  if (Array.isArray(embedding.values)) {
    const values = embedding.values as number[];
    if (values.length === 1536) return values;
    if (values.length > 1536) return values.slice(0, 1536);
    // pad with zeros to 1536 dims
    return values.concat(new Array(1536 - values.length).fill(0));
  }
  if (Array.isArray(embedding)) {
    const values = embedding as number[];
    if (values.length === 1536) return values;
    if (values.length > 1536) return values.slice(0, 1536);
    return values.concat(new Array(1536 - values.length).fill(0));
  }
  return new Array(1536).fill(0);
}

export type EmbeddableChunk = {
  page?: number;
  pageNumber?: number;
  content: string;
};

export type EmbeddedChunk = EmbeddableChunk & {
  embedding: number[];
  tokens: number | null;
};

export async function embedChunks(
  chunks: EmbeddableChunk[]
): Promise<EmbeddedChunk[]> {
  const results: EmbeddedChunk[] = [];

  if (!chunks || chunks.length === 0) {
    console.warn("⚠️ No chunks provided for embedding.");
    return [];
  }

  for (const chunk of chunks) {
    const text = chunk.content?.trim();

    // Skip only truly empty content
    if (!text) {
      console.warn(
        `⚠️ Skipping empty chunk page=${chunk.pageNumber ?? chunk.page}`
      );
      continue;
    }

    try {
      const response = await model.embedContent({
        content: { role: "user", parts: [{ text }] },
      });

      const embedding = sanitizeEmbedding(response?.embedding);
      results.push({
        ...chunk,
        embedding,
        tokens: null,
      });

      console.log(`✅ Embedded chunk page=${chunk.pageNumber ?? chunk.page}`);
    } catch (error) {
      console.error(
        `❌ Embedding failed for page=${chunk.pageNumber ?? chunk.page}:`,
        error
      );

      // Fallback: add zero vector to preserve structure
      results.push({
        ...chunk,
        embedding: new Array(1536).fill(0),
        tokens: null,
      });
    }
  }

  if (results.length === 0) {
    console.warn("⚠️ No embeddings generated. Returning mock data.");
    return chunks.map((chunk) => ({
      ...chunk,
      embedding: new Array(1536).fill(0),
      tokens: null,
    }));
  }

  return results;
}
