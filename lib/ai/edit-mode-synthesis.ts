import { generateText } from "ai";
import { myProvider } from "./providers";
import { embedChunks } from "@/lib/ingest/embed";
import type { ChatContext } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import type { TopicNode } from "@/lib/blocknote/topic-grouping";

export type UnifiedTopic = {
  unifiedName: string;
  unifiedDescription: string;
  pages: number[];
  subtopics: Array<{
    subtopic: string;
    description?: string;
    pages: number[];
  }>;
  sourceTopics: Array<{
    sourceTitle: string;
    originalName: string;
    originalDescription?: string;
  }>;
};

export type SynthesizedContent = {
  topic: UnifiedTopic;
  synthesizedExplanation: string;
  expanded: boolean; // Whether content was expanded from brief to full
  relatedQA: Array<{ question: string; answer: string }>;
};

export type OrganizedSection = {
  sectionTitle: string;
  topics: SynthesizedContent[];
  order: number;
};

/**
 * Phase 1: Semantic Topic Unification
 * Merges similar topics across sources using semantic similarity
 */
export async function semanticTopicUnification(
  sources: ChatContext["sources"]
): Promise<UnifiedTopic[]> {
  if (!sources || sources.length === 0) {
    return [];
  }

  // Collect all topics with their source information
  const allTopics: Array<{
    topic: string;
    description?: string;
    pages: number[];
    subtopics?: Array<{ subtopic: string; description?: string; pages: number[] }>;
    sourceTitle: string;
    sourceIndex: number;
  }> = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    for (const topic of source.mainTopics || []) {
      allTopics.push({
        topic: topic.topic,
        description: topic.description,
        pages: topic.pages || [],
        subtopics: topic.subtopics,
        sourceTitle: source.title,
        sourceIndex: i,
      });
    }
  }

  if (allTopics.length === 0) {
    return [];
  }

  // Generate embeddings for all topics using existing embedChunks function
  const topicTexts = allTopics.map(
    (t) => `${t.topic}${t.description ? `: ${t.description}` : ""}`
  );

  let embeddings: number[][];
  try {
    // Use existing embedChunks function (uses text-embedding-004)
    const embeddedChunks = await embedChunks(
      topicTexts.map((text, index) => ({
        content: text,
        page: index, // Use index as page number
      }))
    );
    embeddings = embeddedChunks.map((chunk) => chunk.embedding);
  } catch (error) {
    console.error("Failed to generate embeddings for topic unification:", error);
    // Fallback to simple name-based grouping
    return fallbackTopicGrouping(sources);
  }

  // Cluster similar topics using cosine similarity
  const clusters: number[][] = [];
  const processed = new Set<number>();
  const similarityThreshold = 0.85; // Adjust based on testing

  for (let i = 0; i < allTopics.length; i++) {
    if (processed.has(i)) continue;

    const cluster = [i];
    processed.add(i);

    for (let j = i + 1; j < allTopics.length; j++) {
      if (processed.has(j)) continue;

      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      if (similarity >= similarityThreshold) {
        cluster.push(j);
        processed.add(j);
      }
    }

    clusters.push(cluster);
  }

  // Merge clusters into unified topics
  const unifiedTopics: UnifiedTopic[] = [];

  for (const cluster of clusters) {
    const clusterTopics = cluster.map((idx) => allTopics[idx]);

    // Pick the best topic name (most descriptive or most common)
    const nameCounts = new Map<string, number>();
    for (const t of clusterTopics) {
      nameCounts.set(t.topic.toLowerCase(), (nameCounts.get(t.topic.toLowerCase()) || 0) + 1);
    }

    let bestName = clusterTopics[0].topic;
    let maxCount = 0;
    for (const [name, count] of nameCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        bestName = clusterTopics.find((t) => t.topic.toLowerCase() === name)?.topic || bestName;
      }
    }

    // Merge descriptions (combine unique information)
    const descriptions = clusterTopics
      .map((t) => t.description)
      .filter((d): d is string => !!d && d.trim().length > 0);
    const uniqueDescriptions = Array.from(new Set(descriptions));
    const mergedDescription = uniqueDescriptions.join(" ").trim() || undefined;

    // Merge pages
    const allPages = new Set<number>();
    for (const t of clusterTopics) {
      t.pages.forEach((p) => allPages.add(p));
    }

    // Merge subtopics
    const subtopicMap = new Map<string, { subtopic: string; description?: string; pages: number[] }>();
    for (const t of clusterTopics) {
      for (const subtopic of t.subtopics || []) {
        const key = subtopic.subtopic.toLowerCase();
        if (subtopicMap.has(key)) {
          const existing = subtopicMap.get(key)!;
          // Merge pages
          const pages = new Set([...existing.pages, ...(subtopic.pages || [])]);
          existing.pages = Array.from(pages);
          // Keep longer description if available
          if (subtopic.description && (!existing.description || subtopic.description.length > existing.description.length)) {
            existing.description = subtopic.description;
          }
        } else {
          subtopicMap.set(key, {
            subtopic: subtopic.subtopic,
            description: subtopic.description,
            pages: subtopic.pages || [],
          });
        }
      }
    }

    unifiedTopics.push({
      unifiedName: bestName,
      unifiedDescription: mergedDescription,
      pages: Array.from(allPages).sort((a, b) => a - b),
      subtopics: Array.from(subtopicMap.values()),
      sourceTopics: clusterTopics.map((t) => ({
        sourceTitle: t.sourceTitle,
        originalName: t.topic,
        originalDescription: t.description,
      })),
    });
  }

  return unifiedTopics;
}

/**
 * Phase 2: Content Synthesis
 * Generates rich, coherent content for a unified topic
 */
export async function synthesizeTopicContent(
  unifiedTopic: UnifiedTopic,
  sources: ChatContext["sources"],
  messages: ChatMessage[],
  documentIds: string[]
): Promise<SynthesizedContent> {
  // Gather existing explanation from Agent Mode
  const existingExplanation = findExplanationForTopic(messages, unifiedTopic.unifiedName);

  // Gather related Q&A
  const relatedQA = findQAByTopic(messages, unifiedTopic.unifiedName);

  // Check if topic is brief (needs expansion)
  const isBrief = !existingExplanation || existingExplanation.length < 100;
  const hasDescription = !!unifiedTopic.unifiedDescription && unifiedTopic.unifiedDescription.length > 50;

  // If we have good content already, use it (but still synthesize if multiple sources)
  if (existingExplanation && !isBrief && unifiedTopic.sourceTopics.length === 1) {
    return {
      topic: unifiedTopic,
      synthesizedExplanation: existingExplanation,
      expanded: false,
      relatedQA,
    };
  }

  // Build context for synthesis
  const sourceContexts = unifiedTopic.sourceTopics.map((st) => {
    const source = sources.find((s) => s.title === st.sourceTitle);
    return {
      sourceTitle: st.sourceTitle,
      topicName: st.originalName,
      description: st.originalDescription || source?.summary || "",
    };
  });

  // Generate synthesized explanation
  let synthesizedExplanation: string;

  // Skip AI synthesis if API is having issues and we have good existing content
  // This prevents repeated failures when the API is overloaded
  const shouldSkipSynthesis =
    existingExplanation &&
    existingExplanation.length > 100 &&
    unifiedTopic.sourceTopics.length <= 1;

  if (shouldSkipSynthesis) {
    // Use existing explanation if it's good quality and from single source
    synthesizedExplanation = existingExplanation;
  } else {
    try {
      const synthesisPrompt = `You are creating a comprehensive study guide section. Synthesize information from multiple sources into a single, coherent explanation.

Topic: ${unifiedTopic.unifiedName}
${unifiedTopic.unifiedDescription ? `Description: ${unifiedTopic.unifiedDescription}` : ""}

Sources:
${sourceContexts.map((sc, i) => `Source ${i + 1}: "${sc.sourceTitle}"
  Topic: ${sc.topicName}
  ${sc.description ? `Description: ${sc.description}` : ""}`).join("\n\n")}

${existingExplanation ? `Existing explanation (use as reference, but improve and expand if needed):\n${existingExplanation}` : ""}

Requirements:
1. Create a comprehensive explanation (${isBrief ? "200-400 words" : "150-300 words"}) that combines information from all sources
2. Remove redundancy and contradictions
3. Structure: Brief introduction → Key concepts → Important details → Practical takeaways
4. Make it educational and clear
5. ${isBrief ? "Expand the brief topic into a full, rich explanation" : "Synthesize and improve the existing content"}

Generate the synthesized explanation:`;

      const { text } = await generateText({
        model: myProvider.languageModel("chat-model"),
        prompt: synthesisPrompt,
        temperature: 0.7,
        maxTokens: 1000,
      });

      synthesizedExplanation = text;
    } catch (error) {
      // Check if it's a quota/rate limit/overload error
      const isApiError =
        error instanceof Error &&
        (error.message.includes("quota") ||
          error.message.includes("429") ||
          error.message.includes("503") ||
          error.message.includes("RESOURCE_EXHAUSTED") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("overloaded") ||
          error.message.includes("rate limit"));

      if (isApiError) {
        console.warn(
          `API error (quota/overload) for topic "${unifiedTopic.unifiedName}". Using fallback content.`
        );
      } else {
        console.error("Failed to synthesize topic content:", error);
      }

      // Fallback to existing explanation or description
      synthesizedExplanation =
        existingExplanation ||
        unifiedTopic.unifiedDescription ||
        `Overview of ${unifiedTopic.unifiedName}`;
    }
  }

  return {
    topic: unifiedTopic,
    synthesizedExplanation,
    expanded: isBrief,
    relatedQA,
  };
}

/**
 * Phase 3: Organize Topics by Learning Flow
 * Groups and orders topics logically
 */
export async function organizeTopicsByLearningFlow(
  synthesizedTopics: SynthesizedContent[]
): Promise<OrganizedSection[]> {
  if (synthesizedTopics.length === 0) {
    return [];
  }

  // Simple organization: group by topic name patterns and order alphabetically/foundational first
  // For now, we'll do a simple grouping. Can be enhanced with AI dependency analysis later.

  const sections: OrganizedSection[] = [
    {
      sectionTitle: "Core Concepts",
      topics: [],
      order: 1,
    },
  ];

  // Sort topics: foundational terms first (Variables, Functions, etc. before Advanced Topics)
  const foundationalKeywords = ["introduction", "basics", "fundamentals", "getting started", "overview", "variables", "functions", "control", "loops"];
  const advancedKeywords = ["advanced", "optimization", "best practices", "patterns", "design"];

  const sortedTopics = [...synthesizedTopics].sort((a, b) => {
    const aName = a.topic.unifiedName.toLowerCase();
    const bName = b.topic.unifiedName.toLowerCase();

    const aIsFoundational = foundationalKeywords.some((kw) => aName.includes(kw));
    const bIsFoundational = foundationalKeywords.some((kw) => bName.includes(kw));
    const aIsAdvanced = advancedKeywords.some((kw) => aName.includes(kw));
    const bIsAdvanced = advancedKeywords.some((kw) => bName.includes(kw));

    if (aIsFoundational && !bIsFoundational) return -1;
    if (!aIsFoundational && bIsFoundational) return 1;
    if (aIsAdvanced && !bIsAdvanced) return 1;
    if (!aIsAdvanced && bIsAdvanced) return -1;

    return aName.localeCompare(bName);
  });

  sections[0].topics = sortedTopics;

  return sections;
}

// Helper functions

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function findExplanationForTopic(messages: ChatMessage[], topicName: string): string | null {
  const topicLower = topicName.toLowerCase().trim();

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const topicExplanationPart = msg.parts?.find(
        (p) => (p as { type?: string }).type === "data-topicExplanation"
      );

      if (topicExplanationPart) {
        const data = (topicExplanationPart as { data?: { topicName?: string } }).data;
        if (data?.topicName?.toLowerCase().trim() === topicLower) {
          const textPart = msg.parts?.find((p) => p.type === "text");
          if (textPart?.text) {
            return textPart.text;
          }
        }
      }
    }
  }

  return null;
}

function findQAByTopic(messages: ChatMessage[], topicName: string): Array<{ question: string; answer: string }> {
  const topicLower = topicName.toLowerCase();
  const qaPairs: Array<{ question: string; answer: string }> = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];

    if (userMsg.role === "user" && assistantMsg.role === "assistant") {
      const questionPart = userMsg.parts?.find((p) => p.type === "text");
      const answerPart = assistantMsg.parts?.find((p) => p.type === "text");

      if (questionPart && answerPart) {
        const question = questionPart.text?.toLowerCase() || "";
        if (question.includes(topicLower) || answerPart.text?.toLowerCase().includes(topicLower)) {
          qaPairs.push({
            question: questionPart.text || "",
            answer: answerPart.text || "",
          });
        }
      }
    }
  }

  return qaPairs;
}

function fallbackTopicGrouping(sources: ChatContext["sources"]): UnifiedTopic[] {
  // Simple name-based grouping as fallback
  const topicMap = new Map<string, UnifiedTopic>();

  for (const source of sources) {
    for (const topic of source.mainTopics || []) {
      const key = topic.topic.toLowerCase().trim();

      if (topicMap.has(key)) {
        const existing = topicMap.get(key)!;
        existing.pages = Array.from(new Set([...existing.pages, ...(topic.pages || [])]));
        existing.sourceTopics.push({
          sourceTitle: source.title,
          originalName: topic.topic,
          originalDescription: topic.description,
        });
      } else {
        topicMap.set(key, {
          unifiedName: topic.topic,
          unifiedDescription: topic.description,
          pages: topic.pages || [],
          subtopics: topic.subtopics || [],
          sourceTopics: [{
            sourceTitle: source.title,
            originalName: topic.topic,
            originalDescription: topic.description,
          }],
        });
      }
    }
  }

  return Array.from(topicMap.values());
}

