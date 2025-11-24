import type { ChatMessage } from "@/lib/types";
import type { PartialBlock } from "@blocknote/core";

/**
 * Convert chat messages to BlockNote blocks
 * This function converts the existing message format to BlockNote blocks
 * for persistent storage in the notebook_blocks table
 */
export function convertMessagesToBlocks(messages: ChatMessage[]): PartialBlock[] {
  const blocks: PartialBlock[] = [];
  
  console.log("🔄 convertMessagesToBlocks: Processing", messages.length, "messages");

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const nextMessage = messages[i + 1];
    
    console.log(`📨 Message ${i + 1}/${messages.length}:`, {
      role: message.role,
      partTypes: message.parts?.map(p => (p as { type?: string }).type) || [],
      hasPdfUpload: message.parts?.some(p => (p as { type?: string }).type === "data-pdfUpload") || false,
    });

    // Check if this is a Q&A pair (user message followed by assistant)
    if (
      message.role === "user" &&
      nextMessage?.role === "assistant" &&
      message.parts?.some((p) => p.type === "text") &&
      nextMessage.parts?.some((p) => p.type === "text")
    ) {
      const questionPart = message.parts.find((p) => p.type === "text");
      const answerPart = nextMessage.parts.find((p) => p.type === "text");

      // Check for special content types that should prevent Q&A block
      const userParts = message.parts || [];
      const assistantParts = nextMessage.parts || [];

      const userContentParts = userParts.filter(
        (p) =>
          (p as { type?: string }).type !== "step-start" &&
          (p as { type?: string }).type !== "step-end" &&
          (p as { type?: string }).type !== "data-usage"
      );
      const assistantContentParts = assistantParts.filter(
        (p) =>
          (p as { type?: string }).type !== "step-start" &&
          (p as { type?: string }).type !== "step-end" &&
          (p as { type?: string }).type !== "data-usage"
      );

      const hasPdfUpload =
        userContentParts.some(
          (p) => (p as { type?: string }).type === "data-pdfUpload"
        ) ||
        assistantContentParts.some(
          (p) => (p as { type?: string }).type === "data-pdfUpload"
        );
      const hasQuiz =
        userContentParts.some(
          (p) =>
            (p as { type?: string }).type === "data-quizOffer" ||
            (p as { type?: string }).type === "data-quiz-question" ||
            (p as { type?: string }).type === "data-quiz-result"
        ) ||
        assistantContentParts.some(
          (p) =>
            (p as { type?: string }).type === "data-quizOffer" ||
            (p as { type?: string }).type === "data-quiz-question" ||
            (p as { type?: string }).type === "data-quiz-result"
        );
      const hasToolCall =
        userContentParts.some(
          (p) => (p as { type?: string }).type?.startsWith("tool-")
        ) ||
        assistantContentParts.some(
          (p) => (p as { type?: string }).type?.startsWith("tool-")
        );
      const hasFile =
        userContentParts.some(
          (p) => (p as { type?: string }).type === "file"
        ) ||
        assistantContentParts.some(
          (p) => (p as { type?: string }).type === "file"
        );

      // Only create Q&A block if no special content types
      if (
        !hasPdfUpload &&
        !hasQuiz &&
        !hasToolCall &&
        !hasFile &&
        questionPart &&
        answerPart
      ) {
        blocks.push({
          type: "questionAnswer",
          props: {
            question: questionPart.text || "",
            answer: answerPart.text || "",
            questionId: message.id,
            answerId: nextMessage.id,
            documentIds: [],
          },
          content: [],
        });
        i++; // Skip next message since we've combined it
        continue;
      }
    }

    // Handle PDF upload messages
    const pdfUploadPart = message.parts?.find(
      (p) => (p as { type?: string }).type === "data-pdfUpload"
    );
    if (pdfUploadPart) {
      const data = (pdfUploadPart as { data?: unknown }).data as
        | { 
            documentId?: string; 
            documentTitle?: string;  // Note: it's "documentTitle", not "title"
            title?: string;  // Fallback for older messages
            pageCount?: number; 
            blobUrl?: string;
            summary?: string;
            mainTopics?: Array<{
              topic: string;
              description?: string;
              pages?: number[];
              subtopics?: Array<{
                subtopic: string;
                description?: string;
                pages?: number[];
              }>;
            }>;
            suggestedActions?: string[];
            chatId?: string;
          }
        | undefined;
      if (data) {
        // Use documentTitle if available, otherwise fall back to title
        const title = data.documentTitle || data.title || "";
        
        console.log("📄 Processing PDF upload data:", {
          title,
          hasSummary: !!data.summary,
          summaryLength: data.summary?.length || 0,
          hasMainTopics: !!data.mainTopics,
          mainTopicsLength: Array.isArray(data.mainTopics) ? data.mainTopics.length : 0,
          documentId: data.documentId,
        });
        
        // 1. Create source block (document title)
        if (title) {
          blocks.push({
            type: "source",
            props: {
              documentId: data.documentId || "",
              title: title,
              pageCount: data.pageCount || 0,
              blobUrl: data.blobUrl || "",
            },
            content: [],
          });
          console.log("✅ Created source block:", title);
        }
        
        // 2. Create summary block (if summary exists)
        if (data.summary && typeof data.summary === "string" && data.summary.trim()) {
          blocks.push({
            type: "summary",
            props: {
              summary: data.summary,
              documentIds: data.documentId ? [data.documentId] : [],
              summaryType: "document",
            },
            content: [],
          });
          console.log("✅ Created summary block (length:", data.summary.length, ")");
        } else {
          console.warn("⚠️ No summary found in PDF upload data");
        }
        
        // 3. Create topic/subtopic blocks (if mainTopics exists)
        if (data.mainTopics && Array.isArray(data.mainTopics) && data.mainTopics.length > 0) {
          const documentIds = data.documentId ? [data.documentId] : [];
          console.log("📚 Creating blocks for", data.mainTopics.length, "topics");
          const topicBlocks = convertTopicsToBlocks(data.mainTopics, documentIds);
          console.log("✅ Created", topicBlocks.length, "topic/subtopic blocks");
          blocks.push(...topicBlocks);
        } else {
          console.warn("⚠️ No mainTopics found in PDF upload data. mainTopics:", data.mainTopics);
        }
        
        continue;
      }
    }

    // Handle regular text messages
    // For text messages, we should convert markdown to blocks properly
    // For now, create paragraph blocks with proper inline content structure
    const textParts = message.parts?.filter((p) => p.type === "text") || [];
    for (const textPart of textParts) {
      if (textPart.text?.trim()) {
        // BlockNote expects content to be an array of inline content elements
        // For simple text, we can create a text inline element
        // But the safest approach is to let BlockNote parse it as markdown
        // For now, create a minimal valid block structure
        blocks.push({
          type: "paragraph",
          content: textPart.text ? [
            {
              type: "text",
              text: textPart.text,
              styles: {},
            }
          ] : [],
        });
      }
    }
  }

  return blocks;
}

/**
 * Convert topic/subtopic data to BlockNote blocks
 */
export function convertTopicsToBlocks(
  topics: Array<{
    topic: string;
    description?: string;
    pages?: number[];
    subtopics?: Array<{
      subtopic: string;
      description?: string;
      pages?: number[];
    }>;
  }>,
  documentIds: string[] = [],
  explanations: Record<string, string> = {}
): PartialBlock[] {
  const blocks: PartialBlock[] = [];

  for (const topic of topics) {
    const topicId = `${topic.topic}-${topic.pages?.join(",") || ""}`;
    const explanation = explanations[topic.topic] || ""; // Don't use description as explanation

    // Create topic block
    blocks.push({
      type: "topicExplanation",
      props: {
        topicName: topic.topic,
        description: topic.description || "",
        explanation, // Empty initially, will be generated on demand
        documentIds,
        topicId,
        parentTopicId: null,
        subtopicIds: topic.subtopics?.map((st) => `${topic.topic}-${st.subtopic}`) || [],
        isSubtopic: false,
        collapsed: true, // Start collapsed by default
        pages: topic.pages || [],
        history: [],
        isGenerating: false,
      },
      content: [],
    });

    // Create subtopic blocks
    if (topic.subtopics) {
      for (const subtopic of topic.subtopics) {
        const subtopicId = `${topic.topic}-${subtopic.subtopic}`;
        const subtopicExplanation = explanations[subtopic.subtopic] || "";

        blocks.push({
          type: "topicExplanation",
          props: {
            topicName: subtopic.subtopic,
            description: subtopic.description || "",
            explanation: subtopicExplanation,
            documentIds,
            topicId: subtopicId,
            parentTopicId: topicId,
            subtopicIds: [],
            isSubtopic: true,
            collapsed: true, // Start collapsed by default
            pages: subtopic.pages || [],
            history: [],
            isGenerating: false,
          },
          content: [],
        });
      }
    }
  }

  return blocks;
}

