import { embedChunks } from "@/lib/ingest/embed";
import type { DocumentChunk } from "@/lib/db/schema";
import type {
  CompressedSummary,
  DocumentQuizConfig,
  DocumentQuizContext,
  SampledSnippet,
} from "@/lib/types/quiz";

const DEFAULT_CONFIG: DocumentQuizConfig = {
  version: 2,
  sampling: {
    periodicInterval: 10,
    maxSamples: 28,
    diversityThreshold: 0.88,
    tokenBudget: 3200,
    topicCoverage: true,
    anchorPages: true,
    minimumSnippets: 6,
  },
  compression: {
    maxSentences: 4,
    maxCharacters: 600,
    minSentenceLength: 40,
    maxSentenceLength: 260,
  },
};

export type DocumentQuizContextExtras = {
  config: DocumentQuizConfig;
  sampledSnippets: SampledSnippet[];
  compressedSummaries: CompressedSummary[];
  totalApproxTokens: number;
};

type ChunkLike = Pick<DocumentChunk, "content" | "page">;

export async function buildDocumentQuizContextExtras({
  chunks,
  context,
  config = DEFAULT_CONFIG,
}: {
  chunks: ChunkLike[];
  context: DocumentQuizContext;
  config?: DocumentQuizConfig;
}): Promise<DocumentQuizContextExtras> {
  const resolvedConfig: DocumentQuizConfig = {
    ...config,
    sampling: { ...DEFAULT_CONFIG.sampling, ...config.sampling },
    compression: { ...DEFAULT_CONFIG.compression, ...config.compression },
  };

  const sortedChunks = [...chunks].sort((a, b) => {
    if (a.page === b.page) {
      return a.content.length - b.content.length;
    }
    return a.page - b.page;
  });

  const sampledSnippets = await selectSnippets(sortedChunks, context, resolvedConfig);
  const compressedSummaries = compressTopics(sortedChunks, context, resolvedConfig);
  const totalApproxTokens = sampledSnippets.reduce(
    (sum, snippet) => sum + snippet.approxTokens,
    0
  );

  return {
    config: resolvedConfig,
    sampledSnippets,
    compressedSummaries,
    totalApproxTokens,
  };
}

async function selectSnippets(
  chunks: ChunkLike[],
  context: DocumentQuizContext,
  config: DocumentQuizConfig
): Promise<SampledSnippet[]> {
  if (chunks.length === 0) {
    return [];
  }

  const selected: SampledSnippet[] = [];
  const embeddings: number[][] = [];
  const seenPages = new Set<number>();

  const addSnippet = async (
    chunk: ChunkLike,
    reason: SampledSnippet["reason"],
    force = false
  ) => {
    const approxTokens = getApproxTokenCount(chunk.content);
    if (!force && selected.length >= config.sampling.maxSamples) {
      return;
    }
    if (!force && approxTokens + totalTokens(selected) > config.sampling.tokenBudget) {
      return;
    }
    if (chunk.content.trim().length < 120) {
      return;
    }
    if (!force && seenPages.has(chunk.page)) {
      return;
    }

    if (!force && embeddings.length > 0) {
      const candidateEmbedding = await embedSnippet(chunk.content);
      if (candidateEmbedding) {
        const isTooSimilar = embeddings.some((embedding) => {
          const similarity = cosineSimilarity(embedding, candidateEmbedding);
          return similarity >= config.sampling.diversityThreshold;
        });
        if (isTooSimilar) {
          return;
        }
        embeddings.push(candidateEmbedding);
      }
    } else if (embeddings.length === 0) {
      const baseEmbedding = await embedSnippet(chunk.content);
      if (baseEmbedding) {
        embeddings.push(baseEmbedding);
      }
    }

    selected.push({
      page: chunk.page,
      content: normalizeWhitespace(chunk.content),
      reason,
      approxTokens,
    });
    seenPages.add(chunk.page);
  };

  if (config.sampling.anchorPages) {
    const first = chunks[0];
    const middle = chunks[Math.floor(chunks.length / 2)];
    const last = chunks[chunks.length - 1];
    await addSnippet(first, "anchor", true);
    if (middle.page !== first.page && middle.page !== last.page) {
      await addSnippet(middle, "anchor");
    }
    await addSnippet(last, "anchor");
  }

  const interval = Math.max(1, config.sampling.periodicInterval);
  for (let index = 0; index < chunks.length; index += interval) {
    if (selected.length >= config.sampling.maxSamples) {
      break;
    }
    await addSnippet(chunks[index], "periodic");
  }

  if (config.sampling.topicCoverage && context.allTopics?.length) {
    for (const [topicIndex, topic] of context.allTopics.entries()) {
      const topicPageSet = new Set(topic.pages || []);
      const candidate = chunks.find((chunk) => topicPageSet.has(chunk.page));
      if (candidate) {
        await addSnippet(candidate, "topic");
      }
      if (topic.subtopics?.length) {
        for (const subtopic of topic.subtopics) {
          const subtopicPageSet = new Set(subtopic.pages || []);
          const subCandidate = chunks.find((chunk) =>
            subtopicPageSet.has(chunk.page)
          );
          if (subCandidate) {
            await addSnippet(subCandidate, "topic");
          }
        }
      }
      if (selected.length >= config.sampling.maxSamples) {
        break;
      }
      if (
        topicIndex >= 1 &&
        selected.length >= config.sampling.minimumSnippets &&
        totalTokens(selected) >= config.sampling.tokenBudget
      ) {
        break;
      }
    }
  }

  if (selected.length < config.sampling.minimumSnippets) {
    for (const chunk of chunks) {
      if (selected.length >= config.sampling.minimumSnippets) {
        break;
      }
      await addSnippet(chunk, "fallback", true);
    }
  }

  return selected.slice(0, config.sampling.maxSamples);
}

function compressTopics(
  chunks: ChunkLike[],
  context: DocumentQuizContext,
  config: DocumentQuizConfig
): CompressedSummary[] {
  const summaries: CompressedSummary[] = [];
  const chunkByPage = new Map<number, string>();
  chunks.forEach((chunk) => {
    if (!chunkByPage.has(chunk.page)) {
      chunkByPage.set(chunk.page, chunk.content);
    }
  });

  const buildSummary = (pages: number[], title: string, kind: "topic" | "subtopic", parentTopicId?: string) => {
    const text = pages
      .map((page) => chunkByPage.get(page))
      .filter(Boolean)
      .join(" ");
    if (!text) {
      return "";
    }
    const normalized = normalizeWhitespace(text);
    const sentences = splitSentences(normalized);
    const scored = sentences
      .map((sentence, index) => ({
        sentence,
        score: scoreSentence(sentence, index, config.compression),
      }))
      .filter((entry) => entry.sentence.length >= config.compression.minSentenceLength);

    scored.sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, config.compression.maxSentences).map((entry) => entry.sentence);
    let summary = selected.join(" ");
    if (summary.length > config.compression.maxCharacters) {
      summary = summary.slice(0, config.compression.maxCharacters);
      const lastSpace = summary.lastIndexOf(".");
      if (lastSpace > config.compression.maxCharacters * 0.6) {
        summary = summary.slice(0, lastSpace + 1);
      }
    }

    const topicId = createTopicId(title, parentTopicId);
    if (!summary) {
      return "";
    }

    summaries.push({
      topicId,
      title,
      summary,
      pages,
      kind,
      parentTopicId,
    });
    return summary;
  };

  context.allTopics?.forEach((topic) => {
    buildSummary(topic.pages || [], topic.topic, "topic");
    topic.subtopics?.forEach((subtopic) => {
      buildSummary(subtopic.pages || [], subtopic.subtopic, "subtopic", topic.topic);
    });
  });

  if (!summaries.length) {
    const allPages = context.allPages || [];
    const fallbackSummary = buildSummary(allPages, context.documentTitle, "topic");
    if (!fallbackSummary) {
      return [];
    }
  }

  return summaries;
}

function createTopicId(title: string, parentTopicId?: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return parentTopicId
    ? `${parentTopicId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${base}`
    : base;
}

async function embedSnippet(content: string): Promise<number[] | null> {
  try {
    const [embedded] = await embedChunks([{ content }]);
    return embedded?.embedding ?? null;
  } catch (error) {
    console.warn("Embedding snippet failed, continuing without diversity guard:", error);
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getApproxTokenCount(text: string): number {
  return Math.ceil(normalizeWhitespace(text).length / 4.2);
}

function totalTokens(snippets: SampledSnippet[]): number {
  return snippets.reduce((sum, snippet) => sum + snippet.approxTokens, 0);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function scoreSentence(
  sentence: string,
  index: number,
  config: DocumentQuizConfig["compression"]
): number {
  let score = 0;
  const length = sentence.length;
  if (length >= config.minSentenceLength && length <= config.maxSentenceLength) {
    score += 2;
  } else {
    score -= 1;
  }
  if (/[A-Z][a-z]+\s(is|are|was|were)\s/.test(sentence)) {
    score += 2;
  }
  if (/\b(for example|for instance|such as|including)\b/i.test(sentence)) {
    score += 1.5;
  }
  if (/\b(because|therefore|as a result|leads to)\b/i.test(sentence)) {
    score += 1.5;
  }
  if (/\d/.test(sentence)) {
    score += 1;
  }
  if (/\b(step|process|method|approach)\b/i.test(sentence)) {
    score += 1;
  }
  score += Math.max(0, 1.2 - index * 0.05);
  return score;
}
