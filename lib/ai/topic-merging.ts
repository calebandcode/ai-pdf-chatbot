"use server";

import { generateObject } from "ai";
import { z } from "zod";
import type { DocumentSummary } from "@/lib/db/schema";
import type { ChatContextSource } from "@/lib/db/queries";
import { embedTopics } from "./topic-embedding";
import {
  addTopicEmbeddings,
  findSimilarTopics,
  getTopicsByChatId,
  type SimilarTopic,
} from "@/lib/vector-db/topic-embeddings";
import type { TopicEmbeddingData } from "@/lib/vector-db/types";
import { findSimilarTopicsInMemory } from "./cosine-similarity";
import { myProvider } from "./providers";

type TopicNode = NonNullable<DocumentSummary["mainTopics"]>[number];

export type MergeCandidate = {
  existingTopic: TopicNode;
  similarity: number;
  relationship: "same" | "related" | "new";
  mergeStrategy: "expand" | "complement" | "create";
};

export type TopicMergeResult = {
  mergedTopics: TopicNode[];
  newTopics: TopicNode[];
  expandedTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
  complementaryTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
};

// Thresholds for topic merging
const SAME_TOPIC_THRESHOLD = 0.85; // Merge as same topic
const RELATED_TOPIC_THRESHOLD = 0.60; // Related topic (subtopic/complementary)

/**
 * Generate a unique topic ID for a topic node
 */
function getTopicId(topic: TopicNode, documentId: string, index: number): string {
  // Use a combination of document ID and topic title for uniqueness
  // Fallback to index if title is empty
  const safeTitle = topic.topic.trim() || `topic-${index}`;
  return `${documentId}-${safeTitle.toLowerCase().replace(/\s+/g, "-")}`;
}

/**
 * Find merge candidates for a new topic using semantic similarity
 * Falls back to in-memory comparison if vector DB is not available
 */
async function findMergeCandidates(
  newTopic: TopicNode,
  newTopicEmbedding: number[],
  chatId: string,
  excludeDocumentIds: string[],
  threshold: number = SAME_TOPIC_THRESHOLD,
  existingTopics: TopicNode[] = [],
  existingEmbeddings: Map<string, number[]> = new Map()
): Promise<MergeCandidate[]> {
  let similarTopics: SimilarTopic[] = [];
  let useInMemoryFallback = false;
  
  // Try to query vector DB first
  try {
    similarTopics = await findSimilarTopics({
      chatId,
      embedding: newTopicEmbedding,
      threshold,
      limit: 10,
      excludeDocumentIds,
    });
  } catch (error) {
    // Vector DB not available, use in-memory fallback
    console.warn(
      "Vector DB query failed, using in-memory similarity comparison:",
      error
    );
    useInMemoryFallback = true;
  }
  
  // If vector DB query returned no results or failed, use in-memory comparison
  if (useInMemoryFallback || similarTopics.length === 0) {
    // Build in-memory topic list with embeddings
    const topicsWithEmbeddings = existingTopics
      .map((topic) => {
        const embedding = existingEmbeddings.get(topic.topic.toLowerCase());
        if (!embedding || embedding.length === 0) {
          return null;
        }
        return {
          topic: {
            topic: topic.topic,
            description: topic.description,
          },
          embedding,
        };
      })
      .filter((t) => t !== null) as Array<{
      topic: { topic: string; description?: string };
      embedding: number[];
    }>;
    
    // Find similar topics using in-memory comparison
    const inMemorySimilar = await findSimilarTopicsInMemory(
      newTopicEmbedding,
      topicsWithEmbeddings,
      threshold
    );
    
    // Convert to MergeCandidate format
    const candidates = inMemorySimilar
      .map((similar) => {
        // Find the full topic node
        const existingTopic = existingTopics.find(
          (t) => t.topic.toLowerCase() === similar.topic.topic.toLowerCase()
        );
        
        if (!existingTopic) {
          // Skip if topic not found (shouldn't happen)
          return null;
        }
        
        let relationship: "same" | "related" | "new";
        let mergeStrategy: "expand" | "complement" | "create";
        
        if (similar.similarity >= SAME_TOPIC_THRESHOLD) {
          relationship = "same";
          mergeStrategy = "expand";
        } else if (similar.similarity >= RELATED_TOPIC_THRESHOLD) {
          relationship = "related";
          mergeStrategy = "complement";
        } else {
          relationship = "new";
          mergeStrategy = "create";
        }
        
        return {
          existingTopic,
          similarity: similar.similarity,
          relationship,
          mergeStrategy,
        };
      })
      .filter((c) => c !== null) as MergeCandidate[];
    
    return candidates;
  }
  
  // Use vector DB results
  return similarTopics.map((similar) => {
    let relationship: "same" | "related" | "new";
    let mergeStrategy: "expand" | "complement" | "create";
    
    if (similar.similarity >= SAME_TOPIC_THRESHOLD) {
      relationship = "same";
      mergeStrategy = "expand";
    } else if (similar.similarity >= RELATED_TOPIC_THRESHOLD) {
      relationship = "related";
      mergeStrategy = "complement";
    } else {
      relationship = "new";
      mergeStrategy = "create";
    }
    
    return {
      existingTopic: similar.topicData,
      similarity: similar.similarity,
      relationship,
      mergeStrategy,
    };
  });
}

/**
 * Merge two topics using the expand strategy (same topic)
 * Now supports AI-powered description synthesis
 */
async function expandTopic(
  existing: TopicNode,
  incoming: TopicNode,
  synthesizeDescriptions = false,
  sourceContext?: {
    existingSource?: string;
    newSource?: string;
  }
): Promise<TopicNode> {
  // Merge pages
  const mergedPages = mergeNumberArrays(existing.pages, incoming.pages);
  
  // Merge descriptions
  let mergedDescription: string | undefined;
  if (synthesizeDescriptions && existing.description && incoming.description) {
    // Use AI synthesis if enabled and both descriptions exist
    try {
      mergedDescription = await synthesizeTopicDescription({
        existingDescription: existing.description,
        newDescription: incoming.description,
        relationshipType: "expand",
        topicName: existing.topic,
        sourceContext,
      });
    } catch (error) {
      console.warn(`Failed to synthesize topic description for "${existing.topic}":`, error);
      // Fallback to picking longer description
      mergedDescription =
        (existing.description?.length ?? 0) > (incoming.description?.length ?? 0)
          ? existing.description || incoming.description
          : incoming.description || existing.description;
    }
  } else {
    // Fallback: prefer longer/more detailed description
    mergedDescription =
      (existing.description?.length ?? 0) > (incoming.description?.length ?? 0)
        ? existing.description || incoming.description
        : incoming.description || existing.description;
  }
  
  // Merge subtopics (with synthesis if enabled)
  const mergedSubtopics = await mergeSubtopics(
    existing.subtopics ?? [],
    incoming.subtopics ?? [],
    synthesizeDescriptions
  );
  
  return {
    topic: existing.topic, // Keep existing topic name
    description: mergedDescription,
    pages: mergedPages,
    subtopics: mergedSubtopics.length > 0 ? mergedSubtopics : undefined,
  };
}

/**
 * Create a complementary topic (related topic)
 * Adds incoming topic as a subtopic of existing topic, or vice versa
 * Now supports AI-powered description synthesis for parent topic
 */
async function createComplementaryTopic(
  existing: TopicNode,
  incoming: TopicNode,
  synthesizeDescriptions = false,
  sourceContext?: {
    existingSource?: string;
    newSource?: string;
  }
): Promise<TopicNode> {
  // If existing topic has no subtopics, create them
  const existingSubtopics = existing.subtopics ?? [];
  
  // Check if incoming topic is already a subtopic
  const isAlreadySubtopic = existingSubtopics.some(
    (st) => st.subtopic.toLowerCase() === incoming.topic.toLowerCase()
  );
  
  if (!isAlreadySubtopic) {
    // Synthesize parent topic description to explain complementary relationship
    let synthesizedDescription = existing.description;
    if (synthesizeDescriptions && existing.description && incoming.description) {
      try {
        synthesizedDescription = await synthesizeTopicDescription({
          existingDescription: existing.description,
          newDescription: `Related complementary topic: ${incoming.topic}. ${incoming.description || "complementary topic"}`,
          relationshipType: "complement",
          topicName: existing.topic,
          sourceContext,
        });
      } catch (error) {
        console.warn(`Failed to synthesize complementary topic description for "${existing.topic}":`, error);
        // Keep existing description on error
      }
    }
    
    // Add incoming topic as a subtopic
    return {
      ...existing,
      description: synthesizedDescription,
      subtopics: [
        ...existingSubtopics,
        {
          subtopic: incoming.topic,
          description: incoming.description,
          pages: incoming.pages,
        },
      ],
    };
  }
  
  // Already a subtopic, just expand
  return existing;
}

/**
 * Merge topics intelligently using semantic similarity
 */
export async function mergeTopicsSemantically({
  existingTopics,
  incomingTopics,
  chatId,
  documentId,
  existingDocumentIds,
  synthesizeDescriptions = false,
  sourceContext,
}: {
  existingTopics: TopicNode[];
  incomingTopics: TopicNode[];
  chatId: string;
  documentId: string;
  existingDocumentIds: string[];
  synthesizeDescriptions?: boolean;
  sourceContext?: {
    existingSource?: string;
    newSource?: string;
  };
}): Promise<TopicMergeResult> {
  if (incomingTopics.length === 0) {
    return {
      mergedTopics: existingTopics,
      newTopics: [],
      expandedTopics: [],
      complementaryTopics: [],
    };
  }
  
  // Step 1: Embed all incoming topics
  const incomingEmbeddings = await embedTopics(incomingTopics);
  
  // Step 1.5: Also embed existing topics for in-memory comparison (if vector DB not available)
  const existingEmbeddings = await embedTopics(existingTopics);
  
  // Step 2: Store incoming topic embeddings in vector DB
  const embeddingData: TopicEmbeddingData[] = incomingTopics.map(
    (topic, index) => ({
      chatId,
      documentId,
      topicId: getTopicId(topic, documentId, index),
      topicTitle: topic.topic,
      topicDescription: topic.description,
      embedding: incomingEmbeddings.get(topic.topic.toLowerCase()) ?? [],
      topicData: topic,
    })
  );
  
  // Filter out topics without embeddings
  const validEmbeddingData = embeddingData.filter(
    (data) => data.embedding.length > 0
  );
  
  // Try to store embeddings, but don't fail if table doesn't exist
  if (validEmbeddingData.length > 0) {
    try {
      await addTopicEmbeddings(validEmbeddingData);
    } catch (error) {
      // If table doesn't exist, we'll just skip storing embeddings
      // The merge will still work using name-based matching as fallback
      console.warn(
        "Failed to store topic embeddings (table may not exist). Continuing with semantic merge using in-memory embeddings.",
        error
      );
    }
  }
  
  // Step 3: For each incoming topic, find merge candidates
  const mergeResults: TopicMergeResult = {
    mergedTopics: [...existingTopics],
    newTopics: [],
    expandedTopics: [],
    complementaryTopics: [],
  };
  
  const existingTopicMap = new Map<string, TopicNode>();
  for (const topic of existingTopics) {
    existingTopicMap.set(topic.topic.toLowerCase(), topic);
  }
  
  for (const incomingTopic of incomingTopics) {
    const embedding = incomingEmbeddings.get(incomingTopic.topic.toLowerCase());
    
    if (!embedding || embedding.length === 0) {
      // No embedding, treat as new topic
      mergeResults.newTopics.push(incomingTopic);
      continue;
    }
    
    // Find merge candidates
    // Pass existing topics and their embeddings for in-memory fallback
    const candidates = await findMergeCandidates(
      incomingTopic,
      embedding,
      chatId,
      existingDocumentIds,
      RELATED_TOPIC_THRESHOLD, // Lower threshold to catch related topics
      existingTopics, // Pass existing topics for in-memory fallback
      existingEmbeddings // Pass existing embeddings for in-memory comparison
    );
    
    if (candidates.length === 0) {
      // No similar topics found, treat as new
      mergeResults.newTopics.push(incomingTopic);
      continue;
    }
    
    // Use the best candidate (highest similarity)
    const bestCandidate = candidates[0];
    
    if (bestCandidate.relationship === "same" && bestCandidate.mergeStrategy === "expand") {
      // Expand existing topic
      const existingTopic = existingTopicMap.get(
        bestCandidate.existingTopic.topic.toLowerCase()
      );
      
      if (existingTopic) {
        const expanded = await expandTopic(
          existingTopic,
          incomingTopic,
          synthesizeDescriptions,
          sourceContext
        );
        existingTopicMap.set(existingTopic.topic.toLowerCase(), expanded);
        mergeResults.expandedTopics.push({
          existing: existingTopic,
          incoming: incomingTopic,
        });
      } else {
        // Existing topic not in map (shouldn't happen), treat as new
        mergeResults.newTopics.push(incomingTopic);
      }
    } else if (
      bestCandidate.relationship === "related" &&
      bestCandidate.mergeStrategy === "complement"
    ) {
      // Create complementary relationship
      const existingTopic = existingTopicMap.get(
        bestCandidate.existingTopic.topic.toLowerCase()
      );
      
      if (existingTopic) {
        const complementary = await createComplementaryTopic(
          existingTopic,
          incomingTopic,
          synthesizeDescriptions,
          sourceContext
        );
        existingTopicMap.set(existingTopic.topic.toLowerCase(), complementary);
        mergeResults.complementaryTopics.push({
          existing: existingTopic,
          incoming: incomingTopic,
        });
      } else {
        // Existing topic not in map, treat as new
        mergeResults.newTopics.push(incomingTopic);
      }
    } else {
      // New topic (similarity too low)
      mergeResults.newTopics.push(incomingTopic);
    }
  }

  // Add all new topics to the merged topics
  for (const newTopic of mergeResults.newTopics) {
    existingTopicMap.set(newTopic.topic.toLowerCase(), newTopic);
  }

  mergeResults.mergedTopics = Array.from(existingTopicMap.values());

  return mergeResults;
}

/**
 * Helper function to merge number arrays (pages)
 */
function mergeNumberArrays(
  a?: number[],
  b?: number[]
): number[] | undefined {
  if (!a?.length && !b?.length) {
    return undefined;
  }
  const set = new Set<number>();
  (a ?? []).forEach((value) => set.add(value));
  (b ?? []).forEach((value) => set.add(value));
  return Array.from(set.values()).sort((x, y) => x - y);
}

/**
 * Helper function to merge subtopics
 * Now supports AI-powered description synthesis
 */
async function mergeSubtopics(
  existing: TopicNode["subtopics"],
  incoming: TopicNode["subtopics"],
  synthesizeDescriptions = false
): Promise<TopicNode["subtopics"]> {
  if (!incoming?.length) {
    return existing;
  }
  if (!existing?.length) {
    return incoming;
  }
  
  const map = new Map<string, NonNullable<TopicNode["subtopics"]>[number]>();
  for (const sub of existing) {
    map.set(sub.subtopic.toLowerCase(), sub);
  }
  
  // Collect subtopics that need synthesis
  const subtopicsToSynthesize: Array<{
    key: string;
    current: NonNullable<TopicNode["subtopics"]>[number];
    incoming: NonNullable<TopicNode["subtopics"]>[number];
  }> = [];
  
  for (const sub of incoming) {
    const key = sub.subtopic.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, sub);
      continue;
    }
    
    // If both descriptions exist and synthesis is enabled, collect for batch synthesis
    if (synthesizeDescriptions && current.description && sub.description) {
      subtopicsToSynthesize.push({ key, current, incoming: sub });
    } else {
      // Simple merge: pick one description
      map.set(key, {
        subtopic: current.subtopic,
        description: current.description || sub.description,
        pages: mergeNumberArrays(current.pages, sub.pages),
      });
    }
  }
  
  // Synthesize subtopic descriptions in batch
  if (subtopicsToSynthesize.length > 0) {
    for (const { key, current, incoming: sub } of subtopicsToSynthesize) {
      try {
        const synthesizedDescription = await synthesizeSubtopicDescription({
          existingDescription: current.description,
          newDescription: sub.description,
          subtopicName: current.subtopic,
        });
        
        map.set(key, {
          subtopic: current.subtopic,
          description: synthesizedDescription || current.description || sub.description,
          pages: mergeNumberArrays(current.pages, sub.pages),
        });
      } catch (error) {
        console.warn(`Failed to synthesize subtopic description for "${current.subtopic}":`, error);
        // Fallback: pick one description
        map.set(key, {
          subtopic: current.subtopic,
          description: current.description || sub.description,
          pages: mergeNumberArrays(current.pages, sub.pages),
        });
      }
    }
  }
  
  return Array.from(map.values());
}

/**
 * Synthesize a topic description using AI
 * Intelligently merges two descriptions to show relationships
 */
async function synthesizeTopicDescription({
  existingDescription,
  newDescription,
  relationshipType,
  topicName,
  sourceContext,
}: {
  existingDescription?: string;
  newDescription?: string;
  relationshipType: "expand" | "complement" | "new";
  topicName: string;
  sourceContext?: { existingSource?: string; newSource?: string };
}): Promise<string | undefined> {
  // If both descriptions are the same or one is missing, return the better one
  if (!existingDescription && !newDescription) {
    return undefined;
  }
  if (!existingDescription) {
    return newDescription;
  }
  if (!newDescription) {
    return existingDescription;
  }
  if (existingDescription === newDescription) {
    return existingDescription;
  }

  // For "new" relationships, use the new description as-is
  if (relationshipType === "new") {
    return newDescription;
  }

  const TopicDescriptionSchema = z.object({
    synthesizedDescription: z
      .string()
      .min(50)
      .max(500)
      .describe(
        "A synthesized description that intelligently merges the existing and new descriptions. For 'expand' relationships, show how the new information enhances the existing topic. For 'complement' relationships, explain how they work together. Make it natural and informative."
      ),
  });

  const systemPrompt = `You are an expert at synthesizing topic descriptions when merging information from multiple sources.

Your task is to create a unified description that:
- For "expand" relationships: Show how new information enhances and deepens the existing topic
- For "complement" relationships: Explain how different aspects work together
- Remove redundancy
- Create a natural, flowing description
- Keep it concise (50-500 characters)`;

  const relationshipContext =
    relationshipType === "expand"
      ? "The new description expands on the existing topic with additional information, examples, or depth."
      : "The new description complements the existing topic, covering related but distinct aspects.";

  const sourceContextStr = sourceContext
    ? `\nSource context: Existing from "${sourceContext.existingSource}", new from "${sourceContext.newSource}"`
    : "";

  const userPrompt = `Topic: ${topicName}
Relationship type: ${relationshipType}
${relationshipContext}

Existing description: ${existingDescription}
New description: ${newDescription}
${sourceContextStr}

Synthesize these descriptions into a single, unified description that intelligently merges them.`;

  try {
    const result = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: TopicDescriptionSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.object.synthesizedDescription;
  } catch (error) {
    console.warn(`Failed to synthesize topic description for "${topicName}":`, error);
    // Fallback: Return the longer description
    return existingDescription.length > newDescription.length ? existingDescription : newDescription;
  }
}

/**
 * Synthesize a subtopic description using AI
 * Intelligently merges two subtopic descriptions
 */
async function synthesizeSubtopicDescription({
  existingDescription,
  newDescription,
  subtopicName,
}: {
  existingDescription?: string;
  newDescription?: string;
  subtopicName: string;
}): Promise<string | undefined> {
  // If both descriptions are the same or one is missing, return the better one
  if (!existingDescription && !newDescription) {
    return undefined;
  }
  if (!existingDescription) {
    return newDescription;
  }
  if (!newDescription) {
    return existingDescription;
  }
  if (existingDescription === newDescription) {
    return existingDescription;
  }

  const SubtopicDescriptionSchema = z.object({
    synthesizedDescription: z
      .string()
      .min(30)
      .max(300)
      .describe(
        "A synthesized description that intelligently merges the existing and new subtopic descriptions. Show how the information complements or expands. Make it natural and concise."
      ),
  });

  const systemPrompt = `You are an expert at synthesizing subtopic descriptions when merging information from multiple sources.

Your task is to create a unified description that:
- Merges information from both descriptions intelligently
- Removes redundancy
- Creates a natural, flowing description
- Keeps it concise (30-300 characters)`;

  const userPrompt = `Subtopic: ${subtopicName}

Existing description: ${existingDescription}
New description: ${newDescription}

Synthesize these descriptions into a single, unified description that intelligently merges them.`;

  try {
    const result = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: SubtopicDescriptionSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.object.synthesizedDescription;
  } catch (error) {
    console.warn(`Failed to synthesize subtopic description for "${subtopicName}":`, error);
    // Fallback: Return the longer description
    return existingDescription.length > newDescription.length ? existingDescription : newDescription;
  }
}

