"use server";

import type { DocumentSummary } from "@/lib/db/schema";
import { embedChunks } from "@/lib/ingest/embed";

type TopicNode = NonNullable<DocumentSummary["mainTopics"]>[number];

/**
 * Generate embedding text from a topic node
 * Combines title + description for richer semantic representation
 */
function getTopicEmbeddingText(topic: TopicNode): string {
  const parts: string[] = [topic.topic];
  
  if (topic.description) {
    parts.push(topic.description);
  }
  
  // Include subtopics in the embedding text for better context
  if (topic.subtopics && topic.subtopics.length > 0) {
    const subtopicTexts = topic.subtopics
      .map((st) => `${st.subtopic}${st.description ? `: ${st.description}` : ""}`)
      .join(", ");
    parts.push(`Subtopics: ${subtopicTexts}`);
  }
  
  return parts.join(". ");
}

/**
 * Embed a single topic
 * Uses the existing embedChunks function which uses Google's text-embedding-004
 */
export async function embedTopic(topic: TopicNode): Promise<number[]> {
  const text = getTopicEmbeddingText(topic);
  
  // Use existing embedChunks function (reuses Google's embedding model)
  const embedded = await embedChunks([
    {
      content: text,
      page: 0, // Topics don't have page numbers
    },
  ]);
  
  if (embedded.length === 0 || !embedded[0].embedding) {
    throw new Error(`Failed to generate embedding for topic: ${topic.topic}`);
  }
  
  return embedded[0].embedding;
}

/**
 * Embed multiple topics in batch
 * More efficient than embedding one at a time
 */
export async function embedTopics(
  topics: TopicNode[]
): Promise<Map<string, number[]>> {
  if (topics.length === 0) {
    return new Map();
  }
  
  // Prepare embedding texts for all topics
  const embeddingTexts = topics.map((topic) => ({
    topic,
    text: getTopicEmbeddingText(topic),
  }));
  
  // Batch embed using existing embedChunks function
  const embedded = await embedChunks(
    embeddingTexts.map((item) => ({
      content: item.text,
      page: 0,
    }))
  );
  
  // Map topics to their embeddings
  const result = new Map<string, number[]>();
  
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const embedding = embedded[i]?.embedding;
    
    if (embedding && embedding.length > 0) {
      // Use topic title as key (should be unique within a document)
      result.set(topic.topic.toLowerCase(), embedding);
    } else {
      console.warn(`Failed to embed topic: ${topic.topic}`);
    }
  }
  
  return result;
}










