import type { ChatContext, SavedBlock } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import type { PartialBlock } from "@blocknote/core";
import type { SynthesizedContent, OrganizedSection } from "@/lib/ai/edit-mode-synthesis";

/**
 * Convert synthesized content to BlockNote blocks
 * Uses the intelligent synthesis pipeline results
 */
export function convertSynthesizedContentToBlocks(
  organizedSections: OrganizedSection[],
  documentIds?: string[]
): PartialBlock[] {
  const blocks: PartialBlock[] = [];

  if (organizedSections.length === 0) {
    return blocks;
  }

  // NOTE: This function is for synthesized content (legacy) - not used in Edit Mode
  // Edit Mode uses convertSavedBlocksToBlocks instead

  // 2. Process each organized section
  for (const section of organizedSections) {
    // Section heading (if multiple sections)
    if (organizedSections.length > 1) {
      blocks.push({
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: section.sectionTitle, styles: { bold: true } }],
      });
    }

    // 3. Process each topic in the section
    for (const synthesized of section.topics) {
      const { topic, synthesizedExplanation, relatedQA } = synthesized;

      // Topic heading
      blocks.push({
        type: "heading",
        props: { level: organizedSections.length > 1 ? 3 : 2 },
        content: [{ type: "text", text: topic.unifiedName, styles: { bold: true } }],
      });

      // Synthesized explanation
      if (synthesizedExplanation) {
        // Split into paragraphs for better formatting
        const paragraphs = synthesizedExplanation.split(/\n\n+/).filter((p) => p.trim());
        for (const para of paragraphs) {
          blocks.push({
            type: "paragraph",
            content: [{ type: "text", text: para.trim() }],
          });
        }
      }

      // Related Q&A
      if (relatedQA.length > 0) {
        blocks.push({
          type: "heading",
          props: { level: organizedSections.length > 1 ? 4 : 3 },
          content: [{ type: "text", text: "Related Questions", styles: { italic: true } }],
        });

        for (const qa of relatedQA) {
          blocks.push({
            type: "questionAnswer",
            props: {
              question: qa.question,
              answer: qa.answer,
              documentIds: documentIds || [],
            },
            content: [],
          });
        }
      }

      // NOTE: Subtopics are NOT shown in Edit Mode - only saved content appears
      // This function is for synthesized content (legacy), but Edit Mode should use convertSavedBlocksToBlocks

      // Source citations (optional, can be shown as metadata)
      if (topic.sourceTopics.length > 1) {
        const sourceNames = topic.sourceTopics.map((st) => st.sourceTitle).join(", ");
        blocks.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `Sources: ${sourceNames}`,
              styles: { italic: true },
            },
          ],
        });
      }
    }
  }

  return blocks;
}

/**
 * Convert chat context to BlockNote blocks - Edit Mode version
 * ONLY shows: document summary (from first source) + user-saved content
 * Does NOT show: topics, explanations, Q&A (unless saved)
 */
export function convertMergedContextToBlocks(
  context: ChatContext | null,
  messages: ChatMessage[] = [],
  documentIds?: string[],
  forEditMode: boolean = false
): PartialBlock[] {
  const blocks: PartialBlock[] = [];

  if (!context || !context.sources || context.sources.length === 0) {
    console.warn("⚠️ convertMergedContextToBlocks: No context or sources", {
      hasContext: !!context,
      hasSources: !!context?.sources,
      sourcesLength: context?.sources?.length,
    });
    return blocks;
  }

  console.log("🔄 convertMergedContextToBlocks called with:", {
    sourcesCount: context.sources.length,
    forEditMode,
    sources: context.sources.map(s => ({ 
      title: s.title, 
      hasSummary: !!s.summary, 
      summaryLength: s.summary?.length || 0, 
      summaryPreview: s.summary?.substring(0, 50) || "none",
    })),
  });

  // 1. Show ONLY the first source's summary (Edit Mode = clean notebook)
  // In Edit Mode, we only show the summary - topics/explanations only appear if saved
  const firstSource = context.sources[0];
  if (firstSource?.title) {
    // Document title as main heading (no "Knowledge Overview")
    blocks.push({
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: firstSource.title, styles: { bold: true } }],
    });
    console.log("✅ Added source title heading");
    
    // Add source summary if available
    if (firstSource.summary && firstSource.summary.trim()) {
      const summaryParagraphs = firstSource.summary.split(/\n\n+/).filter((p) => p.trim());
      console.log("📝 Summary paragraphs:", summaryParagraphs.length);
      for (const para of summaryParagraphs) {
        if (para.trim()) {
          blocks.push({
            type: "paragraph",
            content: [{ type: "text", text: para.trim() }],
          });
          console.log("✅ Added summary paragraph:", para.substring(0, 50));
        }
      }
    } else {
      console.warn("⚠️ Source has no summary or empty summary");
    }
  }
  
  console.log("📊 Blocks after summary:", blocks.length);
  
  // 3. Only show topics/explanations/Q&A if NOT in Edit Mode
  // In Edit Mode, topics only appear if user saved them (handled by convertSavedBlocksToBlocks)
  if (!forEditMode) {
    // Import helper functions
    const { groupTopicsFromSources } = require("./topic-grouping");
    const { findExplanationForTopic, findQAByTopic } = require("./interaction-matcher");

    // Group topics from all sources
    const groupedTopics = groupTopicsFromSources(context.sources);
    console.log("📚 Grouped topics:", groupedTopics.length, groupedTopics.map(t => t.topic));

    // Convert each topic to blocks
    for (const topic of groupedTopics) {
      // Topic heading
      blocks.push({
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: topic.topic, styles: { bold: true } }],
      });

      // Topic description
      if (topic.description) {
        blocks.push({
          type: "paragraph",
          content: [{ type: "text", text: topic.description }],
        });
      }

      // Find AI-generated explanation from messages
      const explanation = findExplanationForTopic(messages, topic.topic);
      if (explanation) {
        const explanationParagraphs = explanation.split(/\n\n+/).filter((p) => p.trim());
        for (const para of explanationParagraphs) {
          blocks.push({
            type: "paragraph",
            content: [{ type: "text", text: para.trim() }],
          });
        }
      }

      // Related Q&A
      const relatedQA = findQAByTopic(messages, topic.topic);
      if (relatedQA.length > 0) {
        blocks.push({
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "Related Questions", styles: { italic: true } }],
        });

        for (const qa of relatedQA) {
          blocks.push({
            type: "questionAnswer",
            props: {
              question: qa.question,
              answer: qa.answer,
              documentIds: documentIds || [],
            },
            content: [],
          });
        }
      }

      // Subtopics
      if (topic.subtopics && topic.subtopics.length > 0) {
        for (const subtopic of topic.subtopics) {
          blocks.push({
            type: "heading",
            props: { level: 3 },
            content: [{ type: "text", text: subtopic.subtopic }],
          });

          if (subtopic.description) {
            blocks.push({
              type: "paragraph",
              content: [{ type: "text", text: subtopic.description }],
            });
          }

          // Find subtopic explanation
          const subtopicExplanation = findExplanationForTopic(messages, subtopic.subtopic);
          if (subtopicExplanation) {
            const subtopicParagraphs = subtopicExplanation.split(/\n\n+/).filter((p) => p.trim());
            for (const para of subtopicParagraphs) {
              blocks.push({
                type: "paragraph",
                content: [{ type: "text", text: para.trim() }],
              });
            }
          }
        }
      }
    }
  } else {
    console.log("📝 Edit Mode: Skipping topics/explanations (only saved content will appear)");
  }

  console.log("✅ Final blocks count:", blocks.length);
  return blocks;
}

/**
 * Convert saved blocks to BlockNote blocks for Edit Mode
 * This is the new primary function - Edit Mode now only shows user-saved content
 */
export function convertSavedBlocksToBlocks(
  savedBlocks: SavedBlock[],
  chatContext: ChatContext | null
): PartialBlock[] {
  const blocks: PartialBlock[] = [];

  // IMPORTANT: This function should ONLY return saved blocks, NOT the summary
  // The summary is handled separately in hybrid-notebook-view.tsx
  // This keeps the separation clean: summary always shown, saved content only when exists

  // If no saved blocks, return empty (summary will be shown separately)
  if (savedBlocks.length === 0) {
    return blocks;
  }

  // Edit Mode: Show ONLY saved content, NO topic/subtopic structure
  // Just convert each saved block directly - no organization by topic
  for (const block of savedBlocks) {
    convertSavedBlockToBlocks(block, blocks);
  }

  return blocks;
}

/**
 * Helper function to convert a single saved block to BlockNote blocks
 */
function convertSavedBlockToBlocks(block: SavedBlock, blocks: PartialBlock[]): void {
  if (block.blockType === "qa" && block.question && block.answer) {
    // Q&A block
    blocks.push({
      type: "questionAnswer",
      props: {
        question: block.question,
        answer: block.answer,
        documentIds: block.documentIds || [],
      },
      content: [],
    });
  } else {
    // Regular content block (explanation, summary, note, definition)
    // Split content into paragraphs
    const paragraphs = block.content.split(/\n\n+/).filter((p) => p.trim());
    for (const para of paragraphs) {
      blocks.push({
        type: "paragraph",
        content: [{ type: "text", text: para.trim() }],
      });
    }
  }
}



