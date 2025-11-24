import { generateObject } from "ai";
import { z } from "zod";
import type { DocumentSummary, ChatContext } from "@/lib/db/schema";
import type { ChatContextSource } from "@/lib/db/queries";
import { myProvider } from "./providers";
import { mergeTopicsSemantically } from "./topic-merging";

// TopicNode from DocumentSummary (required description and pages)
type TopicNode = NonNullable<DocumentSummary["mainTopics"]>[number];

// TopicNode from ChatContext (optional description and pages)
type ChatContextTopicNode = NonNullable<ChatContext["globalTopics"]>[number];

// Union type that accepts both formats
type FlexibleTopicNode = TopicNode | ChatContextTopicNode;

export type ChatContextMergeResult = {
  sources: ChatContextSource[];
  globalSummary: string;
  globalTopics: NonNullable<DocumentSummary["mainTopics"]>;
  deltaMessage: string;
};

// Normalize flexible topic nodes to TopicNode format (required fields)
function normalizeTopics(topics: FlexibleTopicNode[]): TopicNode[] {
  return topics.map((topic) => ({
    topic: topic.topic,
    description: topic.description ?? "",
    pages: topic.pages ?? [],
    subtopics: topic.subtopics?.map((st) => ({
      subtopic: st.subtopic,
      description: st.description,
      pages: st.pages ?? [],
    })),
  }));
}

export async function mergeSourceIntoContext({
  existingSummary,
  existingTopics,
  existingSources,
  source,
  chatId,
  useSemanticMerging = true,
}: {
  existingSummary?: string;
  existingTopics?: FlexibleTopicNode[];
  existingSources?: ChatContextSource[];
  source: ChatContextSource;
  chatId?: string;
  useSemanticMerging?: boolean;
}): Promise<ChatContextMergeResult> {
  // Check if source already exists to prevent duplicates
  const existingSourceIds = new Set((existingSources ?? []).map(s => s.documentId));
  if (existingSourceIds.has(source.documentId)) {
    // Source already exists, return existing context
    // Normalize existingTopics to ensure consistent format
    const normalizedExistingTopics = existingTopics ? normalizeTopics(existingTopics) : [];
    return {
      sources: existingSources ?? [],
      globalSummary: existingSummary ?? "",
      globalTopics: normalizedExistingTopics,
      deltaMessage: `"${source.title}" is already in this notebook.`,
    };
  }

  const updatedSources = [...(existingSources ?? []), source];

  // STEP 1: Merge topics FIRST to get relationship information
  // This must happen before summary synthesis so we have relationship context
  // Normalize existingTopics to TopicNode format (required fields)
  const normalizedExistingTopics = existingTopics ? normalizeTopics(existingTopics) : [];
  
  let mergedTopics: TopicNode[];
  let mergeResult: {
    mergedTopics: TopicNode[];
    newTopics: TopicNode[];
    expandedTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
    complementaryTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
  } | null = null;
  
  if (
    useSemanticMerging &&
    chatId &&
    normalizedExistingTopics.length > 0 &&
    source.mainTopics &&
    source.mainTopics.length > 0
  ) {
    // Use semantic similarity-based merging
    try {
      const existingDocumentIds = (existingSources ?? []).map((s) => s.documentId);
      const existingSourceTitle = existingSources && existingSources.length > 0 ? existingSources[0].title : undefined;
      
      // Enable description synthesis during merge for better integration
      mergeResult = await mergeTopicsSemantically({
        existingTopics: normalizedExistingTopics,
        incomingTopics: source.mainTopics,
        chatId,
        documentId: source.documentId,
        existingDocumentIds,
        synthesizeDescriptions: true, // Enable AI-powered description synthesis
        sourceContext: {
          existingSource: existingSourceTitle,
          newSource: source.title,
        },
      });
      mergedTopics = mergeResult.mergedTopics;
      
      // Topic and subtopic descriptions are now synthesized during merge via:
      // - expandTopic() for expanded topics
      // - createComplementaryTopic() for complementary topics
      // - mergeSubtopics() for merged subtopics
    } catch (error) {
      console.warn(
        "Semantic topic merging failed, falling back to name-based merging:",
        error
      );
      // Fallback to name-based merging
      mergedTopics = mergeTopics(normalizedExistingTopics, source.mainTopics ?? []);
      mergeResult = null;
    }
  } else {
    // Use simple name-based merging (for first source or when semantic merging is disabled)
    mergedTopics = mergeTopics(normalizedExistingTopics, source.mainTopics ?? []);
    
    // If this is the first source and we have chatId, store topic embeddings
    if (
      useSemanticMerging &&
      chatId &&
      normalizedExistingTopics.length === 0 &&
      source.mainTopics &&
      source.mainTopics.length > 0
    ) {
      // Store embeddings for first source (background, don't await)
      import("./topic-merging")
        .then(({ mergeTopicsSemantically }) =>
          mergeTopicsSemantically({
            existingTopics: [],
            incomingTopics: source.mainTopics,
            chatId,
            documentId: source.documentId,
            existingDocumentIds: [],
          })
        )
        .catch((error) => {
          console.warn("Failed to store topic embeddings for first source:", error);
        });
    }
  }

  // STEP 3: Detect source-level relationships
  let sourceRelationship: {
    relationshipType: "complementary" | "expands" | "same_domain" | "different_perspective";
    description: string;
    keyInsights: string[];
  } | null = null;
  
  if (existingSources && existingSources.length > 0) {
    try {
      sourceRelationship = await detectSourceRelationships({
        existingSources,
        newSource: source,
        existingTopics: normalizedExistingTopics,
        mergedTopics,
        mergeResult,
      });
    } catch (error) {
      console.warn("Failed to detect source relationships:", error);
    }
  }

  // STEP 4: Generate merged summary using AI synthesis
  // Now we have topic relationships and source relationships for context
  let globalSummary: string;
  if (!existingSummary || existingSummary.trim().length === 0) {
    // First source - use as-is
    globalSummary = source.summary.trim();
  } else {
    // Use AI to synthesize summaries into a unified, coherent narrative
    try {
      globalSummary = await generateMergedSummary({
        existingSummary,
        newSourceSummary: source.summary,
        existingSources: existingSources ?? [],
        newSource: source,
        mergedTopics,
        mergeResult,
        sourceRelationship,
      });
    } catch (error) {
      console.warn("Failed to generate AI-merged summary, falling back to simple merge:", error);
      // Fallback to simple concatenation if AI synthesis fails
      const MAX_SUMMARY_LENGTH = 2000;
      const trimmedSummary = source.summary.trim();
      const sourceSummaryPreview = trimmedSummary.slice(0, 300);
      const existingLength = existingSummary.length;
      const remainingSpace = MAX_SUMMARY_LENGTH - existingLength - 100;
      
      if (remainingSpace > 50) {
        globalSummary = `${existingSummary.trim()}\n\n• ${source.title}: ${sourceSummaryPreview}${sourceSummaryPreview.length < trimmedSummary.length ? '...' : ''}`;
      } else {
        globalSummary = `${existingSummary.trim()}\n\n• Added: ${source.title}`;
      }
      
      if (globalSummary.length > MAX_SUMMARY_LENGTH) {
        globalSummary = globalSummary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...';
      }
    }
  }

  // Generate more contextual delta message
  let deltaMessage: string;
  if (!existingSummary || existingSummary.trim().length === 0) {
    // First source - simple message
    deltaMessage = `Started your notebook with "${source.title}".`;
  } else {
    // Additional source - provide context about what's new
    const sourceTopics = source.mainTopics ?? [];
    
    if (sourceTopics.length === 0) {
      // No topics in new source - simple message
      deltaMessage = `Added "${source.title}" to your notebook.`;
    } else {
      // Use semantic merge results if available
      if (mergeResult) {
        // Use the merge result to build a contextual delta message
        if (mergeResult.newTopics.length > 0) {
          const topicList = mergeResult.newTopics
            .slice(0, 2)
            .map((t) => t.topic)
            .join(", ");
          const moreText =
            mergeResult.newTopics.length > 2
              ? ` and ${mergeResult.newTopics.length - 2} more`
              : "";
          deltaMessage = `Added "${source.title}" to your notebook. Introduces ${mergeResult.newTopics.length === 1 ? "a new topic" : `${mergeResult.newTopics.length} new topics`}: ${topicList}${moreText}.`;
        } else if (mergeResult.expandedTopics.length > 0) {
          deltaMessage = `Added "${source.title}" to your notebook. Expands on ${mergeResult.expandedTopics.length === 1 ? "an existing topic" : `${mergeResult.expandedTopics.length} existing topics`}.`;
        } else if (mergeResult.complementaryTopics.length > 0) {
          deltaMessage = `Added "${source.title}" to your notebook. Complements ${mergeResult.complementaryTopics.length === 1 ? "an existing topic" : `${mergeResult.complementaryTopics.length} existing topics`}.`;
        } else {
          // Topics were merged but no obvious changes
          deltaMessage = `Added "${source.title}" to your notebook.`;
        }
      } else {
        // Fallback to name-based analysis (for non-semantic merging)
        // Use normalizedExistingTopics which is already normalized
        const newTopics = sourceTopics.filter(
          (topic) =>
            !normalizedExistingTopics.some(
              (existing) =>
                existing.topic.toLowerCase() === topic.topic.toLowerCase()
            )
        );
        const expandedTopics = sourceTopics.filter((topic) =>
          normalizedExistingTopics.some(
            (existing) =>
              existing.topic.toLowerCase() === topic.topic.toLowerCase()
          )
        );
        
        // Build informative but concise delta message
        if (newTopics.length > 0) {
          const topicList = newTopics.slice(0, 2).map((t) => t.topic).join(", ");
          const moreText =
            newTopics.length > 2 ? ` and ${newTopics.length - 2} more` : "";
          deltaMessage = `Added "${source.title}" to your notebook. Introduces ${newTopics.length === 1 ? "a new topic" : `${newTopics.length} new topics`}: ${topicList}${moreText}.`;
        } else if (expandedTopics.length > 0) {
          deltaMessage = `Added "${source.title}" to your notebook. Expands on ${expandedTopics.length === 1 ? "an existing topic" : `${expandedTopics.length} existing topics`}.`;
        } else {
          // Fallback: just mention the source was added
          deltaMessage = `Added "${source.title}" to your notebook.`;
        }
      }
    }
  }

  return {
    sources: updatedSources,
    globalSummary,
    globalTopics: mergedTopics,
    deltaMessage,
  };
}

function mergeTopics(
  existing: TopicNode[],
  incoming: TopicNode[]
): TopicNode[] {
  if (incoming.length === 0) {
    return existing;
  }

  const map = new Map<string, TopicNode>();

  for (const topic of existing) {
    map.set(topic.topic.toLowerCase(), topic);
  }

  for (const topic of incoming) {
    const key = topic.topic.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, topic);
      continue;
    }

    map.set(key, {
      topic: current.topic,
      description: current.description || topic.description,
      pages: mergeNumberArrays(current.pages, topic.pages),
      subtopics: mergeSubtopics(current.subtopics ?? [], topic.subtopics ?? []),
    });
  }

  return Array.from(map.values());
}

function mergeSubtopics(
  existing: TopicNode["subtopics"],
  incoming: TopicNode["subtopics"]
): TopicNode["subtopics"] {
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
  for (const sub of incoming) {
    const key = sub.subtopic.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, sub);
      continue;
    }
    map.set(key, {
      subtopic: current.subtopic,
      description: current.description || sub.description,
      pages: mergeNumberArrays(current.pages, sub.pages),
    });
  }

  return Array.from(map.values());
}

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
 * Detect source-level relationships between existing and new sources
 * Returns how sources relate conceptually (complementary, expands, same domain, etc.)
 */
async function detectSourceRelationships({
  existingSources,
  newSource,
  existingTopics,
  mergedTopics,
  mergeResult,
}: {
  existingSources: ChatContextSource[];
  newSource: ChatContextSource;
  existingTopics: TopicNode[];
  mergedTopics: TopicNode[];
  mergeResult: {
    mergedTopics: TopicNode[];
    newTopics: TopicNode[];
    expandedTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
    complementaryTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
  } | null;
}): Promise<{
  relationshipType: "complementary" | "expands" | "same_domain" | "different_perspective";
  description: string;
  keyInsights: string[];
}> {
  const SourceRelationshipSchema = z.object({
    relationshipType: z.enum(["complementary", "expands", "same_domain", "different_perspective"]),
    description: z
      .string()
      .min(50)
      .max(500)
      .describe(
        "A concise description of how the sources relate conceptually. For example: 'Bash and Python are both scripting languages, but Bash focuses on command-line and system automation while Python provides general-purpose programming capabilities.'"
      ),
    keyInsights: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe(
        "Key insights about how the sources relate: what's complementary, what expands existing knowledge, what's new, etc."
      ),
  });

  // Build context about existing sources
  const existingSourceContext = existingSources
    .map((s) => `- ${s.title}: ${s.summary.slice(0, 200)}...`)
    .join("\n");

  const existingTopicNames = existingTopics.map((t) => t.topic).join(", ");
  const newTopicNames = (newSource.mainTopics ?? []).map((t) => t.topic).join(", ");

  // Build topic relationship context
  let topicRelationshipContext = "";
  if (mergeResult) {
    if (mergeResult.complementaryTopics.length > 0) {
      topicRelationshipContext += `\n- Complementary topics: ${mergeResult.complementaryTopics
        .map((p) => `${p.existing.topic} ↔ ${p.incoming.topic}`)
        .join(", ")}`;
    }
    if (mergeResult.expandedTopics.length > 0) {
      topicRelationshipContext += `\n- Expanded topics: ${mergeResult.expandedTopics
        .map((p) => p.existing.topic)
        .join(", ")}`;
    }
    if (mergeResult.newTopics.length > 0) {
      topicRelationshipContext += `\n- New topics: ${mergeResult.newTopics.map((t) => t.topic).join(", ")}`;
    }
  }

  const systemPrompt = `You are an expert at analyzing how different sources of information relate to each other.

Your task is to determine how a new source relates to existing sources in a knowledge base.

Relationship types:
- **complementary**: Sources cover related but distinct topics that work together (e.g., Bash + Python, both scripting languages but different purposes)
- **expands**: New source adds depth, examples, or advanced content to existing topics
- **same_domain**: Sources cover the same domain/subject but from different angles or depths
- **different_perspective**: Sources cover similar topics but from different viewpoints or contexts

Focus on conceptual relationships, not just topic overlap.`;

  const userPrompt = `Existing sources:
${existingSourceContext}

Existing topics: ${existingTopicNames || "None"}

New source: ${newSource.title}
New source summary: ${newSource.summary.slice(0, 400)}...
New topics: ${newTopicNames || "None"}
${topicRelationshipContext}

Analyze how the new source relates to the existing sources. Consider:
1. Are they complementary (related but distinct purposes)?
2. Does the new source expand on existing topics?
3. Are they in the same domain but different perspectives?
4. What are the key conceptual relationships?

Return the relationship type, a concise description, and key insights.`;

  try {
    const result = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: SourceRelationshipSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.object;
  } catch (error) {
    console.warn("Failed to detect source relationships, using fallback:", error);
    // Fallback: Determine basic relationship from topic overlap
    const hasNewTopics = mergeResult && mergeResult.newTopics.length > 0;
    const hasComplementary = mergeResult && mergeResult.complementaryTopics.length > 0;
    const hasExpanded = mergeResult && mergeResult.expandedTopics.length > 0;

    if (hasComplementary) {
      return {
        relationshipType: "complementary",
        description: `The new source complements existing sources by covering related but distinct topics.`,
        keyInsights: ["Sources are related but serve different purposes"],
      };
    }
    if (hasExpanded) {
      return {
        relationshipType: "expands",
        description: `The new source expands on existing topics with additional depth and examples.`,
        keyInsights: ["Adds depth to existing topics"],
      };
    }
    if (hasNewTopics) {
      return {
        relationshipType: "same_domain",
        description: `The new source covers topics in the same domain as existing sources.`,
        keyInsights: ["Adds new topics to the domain"],
      };
    }

    return {
      relationshipType: "same_domain",
      description: `The new source relates to existing sources in the knowledge base.`,
      keyInsights: ["Source added to knowledge base"],
    };
  }
}

/**
 * Synthesize topic descriptions using AI
 * Creates intelligent descriptions that explain how topics relate when merged
 */
async function synthesizeTopicDescriptions({
  mergedTopics,
  mergeResult,
  existingSources,
  newSource,
}: {
  mergedTopics: TopicNode[];
  mergeResult: {
    mergedTopics: TopicNode[];
    newTopics: TopicNode[];
    expandedTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
    complementaryTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
  } | null;
  existingSources: ChatContextSource[];
  newSource: ChatContextSource;
}): Promise<TopicNode[]> {
  if (!mergeResult) {
    return mergedTopics;
  }

  // Batch process topics that need description synthesis
  const topicsToSynthesize: Array<{
    topic: TopicNode;
    relationshipType: "expand" | "complement" | "new";
    existingDescription?: string;
    newDescription?: string;
    sourceContext?: { existingSource?: string; newSource?: string };
  }> = [];

  // Process expanded topics
  for (const { existing, incoming } of mergeResult.expandedTopics) {
    const mergedTopic = mergedTopics.find((t) => t.topic === existing.topic);
    if (mergedTopic) {
      topicsToSynthesize.push({
        topic: mergedTopic,
        relationshipType: "expand",
        existingDescription: existing.description,
        newDescription: incoming.description,
        sourceContext: {
          existingSource: existingSources[0]?.title,
          newSource: newSource.title,
        },
      });
    }
  }

  // Process complementary topics (when one becomes a subtopic of the other)
  // Synthesize the parent topic description to explain the relationship
  for (const { existing, incoming } of mergeResult.complementaryTopics) {
    const mergedTopic = mergedTopics.find((t) => t.topic === existing.topic);
    if (mergedTopic && mergedTopic.subtopics) {
      // Find the subtopic that was added from the incoming topic
      const addedSubtopic = mergedTopic.subtopics.find(
        (st) => st.subtopic.toLowerCase() === incoming.topic.toLowerCase()
      );
      
      if (addedSubtopic) {
        // Synthesize the parent topic description to explain the complementary relationship
        topicsToSynthesize.push({
          topic: mergedTopic,
          relationshipType: "complement",
          existingDescription: existing.description,
          newDescription: `Related to ${incoming.topic}: ${incoming.description || "complementary topic"}`,
          sourceContext: {
            existingSource: existingSources[0]?.title,
            newSource: newSource.title,
          },
        });
      }
    }
  }

  // If no topics to synthesize, return as-is
  if (topicsToSynthesize.length === 0) {
    return mergedTopics;
  }

  // Synthesize descriptions in batches
  const synthesizedTopics = [...mergedTopics];
  
  for (const item of topicsToSynthesize) {
    try {
      const synthesizedDescription = await synthesizeSingleTopicDescription({
        existingDescription: item.existingDescription,
        newDescription: item.newDescription,
        relationshipType: item.relationshipType,
        topicName: item.topic.topic,
        sourceContext: item.sourceContext,
      });

      // Update the topic description
      const index = synthesizedTopics.findIndex((t) => t.topic === item.topic.topic);
      if (index !== -1 && synthesizedDescription) {
        synthesizedTopics[index] = {
          ...synthesizedTopics[index],
          description: synthesizedDescription,
        };
      }
    } catch (error) {
      console.warn(`Failed to synthesize description for topic "${item.topic.topic}":`, error);
      // Keep original description on error
    }
  }

  return synthesizedTopics;
}

/**
 * Synthesize a single topic description using AI
 */
async function synthesizeSingleTopicDescription({
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

  // For "expand" relationships, synthesize to show how new info enhances existing
  // For "complement" relationships, show how they work together
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
 * Generate a merged summary using AI synthesis
 * Creates a unified, coherent narrative that relates sources intelligently
 * Now uses topic relationships and source relationships for better context
 */
async function generateMergedSummary({
  existingSummary,
  newSourceSummary,
  existingSources,
  newSource,
  mergedTopics,
  mergeResult,
  sourceRelationship,
}: {
  existingSummary: string;
  newSourceSummary: string;
  existingSources: ChatContextSource[];
  newSource: ChatContextSource;
  mergedTopics: TopicNode[];
  mergeResult: {
    mergedTopics: TopicNode[];
    newTopics: TopicNode[];
    expandedTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
    complementaryTopics: Array<{ existing: TopicNode; incoming: TopicNode }>;
  } | null;
  sourceRelationship: {
    relationshipType: "complementary" | "expands" | "same_domain" | "different_perspective";
    description: string;
    keyInsights: string[];
  } | null;
}): Promise<string> {
  const MAX_SUMMARY_LENGTH = 3000;
  
  const MergedSummarySchema = z.object({
    mergedSummary: z
      .string()
      .min(100)
      .max(MAX_SUMMARY_LENGTH)
      .describe(
        "A unified, coherent summary that synthesizes information from all sources. MUST explicitly explain how sources relate conceptually (e.g., 'Bash and Python are both scripting languages, but Bash focuses on command-line automation while Python provides general-purpose programming'). Should sound natural and conversational, like a tutor explaining the combined knowledge base. Remove repetitive conversational openings, focus on relationships between sources, and highlight what's new or how sources complement each other."
      ),
  });

  // Build context about existing sources
  const existingSourceTitles = existingSources.map((s) => s.title).join(", ");
  
  // Build topic context with synthesized descriptions
  const topicContext = mergedTopics
    .slice(0, 15)
    .map((t) => {
      const desc = t.description ? `: ${t.description}` : "";
      return `- ${t.topic}${desc}`;
    })
    .join("\n");
  
  // Build topic relationship context
  let topicRelationshipContext = "";
  if (mergeResult) {
    if (mergeResult.complementaryTopics.length > 0) {
      topicRelationshipContext += `\n\nCOMPLEMENTARY TOPICS (related but distinct):\n${mergeResult.complementaryTopics
        .map((p) => `- ${p.existing.topic} ↔ ${p.incoming.topic} (complementary relationship)`)
        .join("\n")}`;
    }
    if (mergeResult.expandedTopics.length > 0) {
      topicRelationshipContext += `\n\nEXPANDED TOPICS (new source adds depth):\n${mergeResult.expandedTopics
        .map((p) => `- ${p.existing.topic} (expanded with new information)`)
        .join("\n")}`;
    }
    if (mergeResult.newTopics.length > 0) {
      topicRelationshipContext += `\n\nNEW TOPICS (introduced by new source):\n${mergeResult.newTopics
        .map((t) => `- ${t.topic}${t.description ? `: ${t.description}` : ""}`)
        .join("\n")}`;
    }
  }
  
  // Build source relationship context
  let sourceRelationshipContext = "";
  if (sourceRelationship) {
    sourceRelationshipContext = `\n\nSOURCE RELATIONSHIP:\nType: ${sourceRelationship.relationshipType}\nDescription: ${sourceRelationship.description}\nKey Insights:\n${sourceRelationship.keyInsights.map((i) => `- ${i}`).join("\n")}`;
  }

  const systemPrompt = `You are an AI tutor synthesizing knowledge from multiple sources into a unified, coherent summary.

CRITICAL REQUIREMENTS:
1. **EXPLICITLY EXPLAIN RELATIONSHIPS**: You MUST explain how sources relate conceptually. For example:
   - If sources are complementary: "Bash and Python are both scripting languages, but Bash focuses on command-line and system automation while Python provides general-purpose programming capabilities."
   - If sources expand: "The new source deepens your understanding of [topic] with advanced examples and practical applications."
   - If sources are in the same domain: "Both sources cover [domain], with the new source adding [specific contributions]."

2. **CREATE UNIFIED NARRATIVE**: Write as if explaining ONE continuous learning journey, not separate documents. Show how ideas connect and build upon each other.

3. **REMOVE REDUNDANCY**: Don't repeat conversational openings. Start directly with the unified narrative.

4. **HIGHLIGHT RELATIONSHIPS**: Use the topic relationships and source relationship information to explicitly show how sources complement, expand, or relate to each other.

5. **NATURAL FLOW**: Write in a conversational, enthusiastic tone that flows naturally from one idea to the next.

Avoid:
- Repetitive openings like "Hey, I just finished..." multiple times
- Bullet-point lists or source-by-source breakdowns
- Generic statements without explaining relationships
- Simply concatenating summaries
- Talking about "documents" - focus on the knowledge itself

Instead:
- Start with how sources relate conceptually
- Create a unified narrative that connects ideas
- Explicitly explain complementary relationships (e.g., "Both are scripting languages but serve different purposes")
- Show how new sources enhance existing knowledge
- Make it feel like one continuous learning experience`;

  const prompt = `Synthesize these summaries into a unified, coherent narrative that EXPLICITLY explains how sources relate:

EXISTING KNOWLEDGE BASE:
Sources: ${existingSourceTitles}
Summary: ${existingSummary}

NEW SOURCE ADDED:
Title: ${newSource.title}
Summary: ${newSourceSummary}

TOPICS (with synthesized descriptions):
${topicContext || "No topics yet"}
${topicRelationshipContext}

${sourceRelationshipContext}

CRITICAL: You MUST explicitly explain how the sources relate conceptually. Use the relationship information above to create a narrative that:
1. Starts by explaining how sources relate (e.g., "Bash and Python are both scripting languages, but Bash focuses on command-line automation while Python provides general-purpose programming")
2. Shows how topics complement, expand, or relate to each other
3. Creates a unified narrative that flows naturally
4. Removes repetitive conversational openings
5. Highlights what's new and how it enhances existing knowledge
6. Maintains an enthusiastic, conversational tone
7. Sounds like one continuous learning journey
8. Stays within ${MAX_SUMMARY_LENGTH} characters

Focus on creating a narrative that helps the student understand their combined knowledge base and how sources relate, not on listing sources separately.`;

  const result = await generateObject({
    model: myProvider.languageModel("chat-model"),
    schema: MergedSummarySchema,
    system: systemPrompt,
    prompt,
  });

  return result.object.mergedSummary.trim();
}
