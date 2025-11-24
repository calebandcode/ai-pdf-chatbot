"use server";

import type { ChatContext } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import {
  semanticTopicUnification,
  synthesizeTopicContent,
  organizeTopicsByLearningFlow,
  type SynthesizedContent,
} from "@/lib/ai/edit-mode-synthesis";

/**
 * Server action to synthesize Edit Mode content
 * Phase 1: Unify topics (eager)
 * Phase 2: Synthesize content (can be lazy, but we'll do eager for now)
 * Phase 3: Organize topics
 */
export async function synthesizeEditModeContent(
  context: ChatContext | null,
  messages: ChatMessage[] = [],
  documentIds: string[] = []
): Promise<{
  unifiedTopics: Array<{
    unifiedName: string;
    unifiedDescription?: string;
    pages: number[];
    subtopics: Array<{ subtopic: string; description?: string; pages: number[] }>;
    sourceTopics: Array<{ sourceTitle: string; originalName: string; originalDescription?: string }>;
  }>;
  synthesizedContent: SynthesizedContent[];
  organizedSections: Array<{
    sectionTitle: string;
    topics: SynthesizedContent[];
    order: number;
  }>;
}> {
  if (!context || !context.sources || context.sources.length === 0) {
    return {
      unifiedTopics: [],
      synthesizedContent: [],
      organizedSections: [],
    };
  }

  try {
    // Phase 1: Semantic Topic Unification (eager)
    const unifiedTopics = await semanticTopicUnification(context.sources);

    // Phase 2: Synthesize content for each unified topic
    // Process sequentially with delays to respect API rate limits (free tier: 10 req/min)
    // Also helps avoid 503 overload errors by spacing out requests
    const synthesizedContent: SynthesizedContent[] = [];
    const BATCH_SIZE = 2; // Reduced to 2 topics at a time to reduce load
    const DELAY_MS = 10000; // 10 second delay between batches (more conservative)

    for (let i = 0; i < unifiedTopics.length; i += BATCH_SIZE) {
      const batch = unifiedTopics.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((topic) =>
          synthesizeTopicContent(topic, context.sources, messages, documentIds)
        )
      );
      
      synthesizedContent.push(...batchResults);

      // Add delay between batches (except for the last batch)
      if (i + BATCH_SIZE < unifiedTopics.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    // Phase 3: Organize topics by learning flow
    const organizedSections = await organizeTopicsByLearningFlow(synthesizedContent);

    return {
      unifiedTopics,
      synthesizedContent,
      organizedSections,
    };
  } catch (error) {
    console.error("Failed to synthesize Edit Mode content:", error);
    // Return empty result on error
    return {
      unifiedTopics: [],
      synthesizedContent: [],
      organizedSections: [],
    };
  }
}

