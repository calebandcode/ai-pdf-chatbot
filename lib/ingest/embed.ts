import { ChatSDKError } from "@/lib/errors";

export type EmbeddableChunk = {
  page: number;
  content: string;
};

export type EmbeddedChunk = EmbeddableChunk & {
  embedding: number[];
  tokens: number | null;
};

const MODEL = "text-embedding-3-small";
const EMBEDDING_ENDPOINT = "https://api.openai.com/v1/embeddings";

type EmbeddingResponse = {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

async function requestEmbedding(
  input: string,
  apiKey: string
): Promise<{ embedding: EmbeddedChunk["embedding"]; tokens: number | null }> {
  const response = await fetch(EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input,
    }),
  });

  const payload = (await response.json()) as EmbeddingResponse;

  if (!response.ok) {
    const message =
      payload?.error?.message ?? "Failed to generate embeddings for chunk";
    throw new ChatSDKError("bad_request:api", message);
  }

  const embedding = payload.data?.at(0)?.embedding;

  if (!embedding) {
    throw new ChatSDKError(
      "bad_request:api",
      "Embedding response did not include data"
    );
  }

  const tokens =
    typeof payload.usage?.prompt_tokens === "number"
      ? payload.usage.prompt_tokens
      : typeof payload.usage?.total_tokens === "number"
        ? payload.usage.total_tokens
        : null;

  return { embedding, tokens };
}

export async function embedChunks(
  chunks: EmbeddableChunk[]
): Promise<EmbeddedChunk[]> {
  if (chunks.length === 0) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new ChatSDKError(
      "bad_request:api",
      "OPENAI_API_KEY environment variable is not set"
    );
  }

  const results: EmbeddedChunk[] = [];

  for (const chunk of chunks) {
    const { embedding, tokens } = await requestEmbedding(
      chunk.content,
      apiKey
    );

    results.push({
      ...chunk,
      embedding,
      tokens,
    });
  }

  return results;
}
