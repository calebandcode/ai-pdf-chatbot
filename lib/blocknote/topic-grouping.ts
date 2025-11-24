import type { ChatContext } from "@/lib/db/schema";

export type TopicNode = {
  topic: string;
  description?: string;
  pages?: number[];
  subtopics?: Array<{
    subtopic: string;
    description?: string;
    pages?: number[];
  }>;
};

/**
 * Group topics from all sources (simple grouping, no AI)
 * Topics with same name are combined, subtopics merged
 */
export function groupTopicsFromSources(
  sources: ChatContext["sources"]
): TopicNode[] {
  const topicMap = new Map<string, TopicNode>();

  for (const source of sources) {
    for (const topic of source.mainTopics || []) {
      const topicKey = topic.topic.toLowerCase().trim();
      
      if (topicMap.has(topicKey)) {
        // Topic exists - merge subtopics and pages
        const existing = topicMap.get(topicKey)!;
        
        // Merge subtopics
        const existingSubtopicKeys = new Set(
          (existing.subtopics || []).map(st => st.subtopic.toLowerCase())
        );
        
        const newSubtopics = (topic.subtopics || []).filter(
          st => !existingSubtopicKeys.has(st.subtopic.toLowerCase())
        );
        
        existing.subtopics = [
          ...(existing.subtopics || []),
          ...newSubtopics
        ];
        
        // Combine pages
        existing.pages = [
          ...new Set([
            ...(existing.pages || []),
            ...(topic.pages || [])
          ])
        ];
      } else {
        // New topic - add it
        topicMap.set(topicKey, {
          topic: topic.topic,
          description: topic.description,
          pages: topic.pages || [],
          subtopics: topic.subtopics || []
        });
      }
    }
  }

  return Array.from(topicMap.values());
}

/**
 * Combine summaries from all sources (simple concatenation)
 */
export function combineSummaries(sources: ChatContext["sources"]): string {
  const summaries = sources
    .map(s => {
      if (s.summary && s.summary.trim()) {
        return s.title ? `${s.title}\n\n${s.summary}` : s.summary;
      }
      return null;
    })
    .filter((s): s is string => s !== null);
  
  return summaries.join("\n\n");
}


