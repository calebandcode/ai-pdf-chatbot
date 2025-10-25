"use server";

import { generateText } from "ai";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { getDocumentChunks } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

type TopicExplanationParams = {
  topicName: string;
  description: string;
  pages: number[];
  documentTitle?: string;
  previousTopics?: string[];
  currentIndex?: number;
  totalTopics?: number;
  documentIds?: string[]; // Add documentIds to fetch actual content
};

export async function generateTopicExplanationAction({
  topicName,
  description,
  pages,
  documentTitle,
  previousTopics = [],
  currentIndex = 0,
  totalTopics = 1,
  documentIds = [], // Add default empty array
}: TopicExplanationParams) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get actual document content if documentIds are provided
    let documentContent = "";
    if (documentIds.length > 0) {
      console.log("🔍 Fetching document content for topic explanation:", {
        topicName,
        pages,
        documentIds,
      });
      
      const allChunks: any[] = [];
      for (const documentId of documentIds) {
        const chunks = await getDocumentChunks({ documentId });
        const relevantChunks = chunks.filter((chunk) =>
          pages.includes(chunk.page)
        );
        allChunks.push(...relevantChunks);
      }

      if (allChunks.length > 0) {
        documentContent = allChunks
          .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
          .join("\n\n");
        console.log("✅ Found document content:", documentContent.slice(0, 200) + "...");
      } else {
        console.warn("⚠️ No document chunks found for pages:", pages);
      }
    }

    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      system: `You are a supportive AI tutor continuing an ongoing study session. You're helping a student learn from their uploaded document in a natural, conversational way.

Key behaviors:
- Continue the study conversation naturally - don't restart or reintroduce the document
- Use conversational connectors like "Now let's explore...", "Building on that idea...", "Earlier we looked at..."
- Keep your tone warm, encouraging, and human - like a real tutor
- Avoid formal headers, labels, or "summary" language
- Present everything as a natural flow of the study conversation
- Use examples and analogies to make concepts relatable
- Be encouraging and supportive throughout
- Mention specific page references naturally in context
- CRITICAL: Base your explanation ONLY on the actual document content provided below`,
      prompt: `You are continuing an ongoing study session with a student.

${previousTopics.length > 0 ? `You just explained ${previousTopics[previousTopics.length - 1]}. The next topic is ${topicName}. Connect the two smoothly.` : `This is the first topic: ${topicName}.`}

CONTEXT:
- Document: ${documentTitle || "the uploaded document"}
- Pages: ${pages.join(", ")}

${documentContent ? `ACTUAL DOCUMENT CONTENT TO BASE EXPLANATION ON:
${documentContent}

IMPORTANT: Use ONLY the content shown above to explain this topic. Do not create generic explanations.` : "No document content available - provide a general explanation."}

Write as if you're continuing a natural conversation.`,
    });

    return { success: true, explanation: text };
  } catch (error) {
    console.error("Failed to generate topic explanation:", error);
    return {
      success: false,
      explanation: "Failed to generate explanation. Please try again.",
    };
  }
}

type SubtopicExplanationParams = {
  parentTopic: string;
  subtopicName: string;
  pages: number[];
  documentTitle?: string;
  previousTopics?: string[];
  currentIndex?: number;
  totalTopics?: number;
  documentIds?: string[]; // Add documentIds to fetch actual content
};

export async function generateSubtopicExplanationAction({
  parentTopic,
  subtopicName,
  pages,
  documentTitle,
  previousTopics = [],
  currentIndex = 0,
  totalTopics = 1,
  documentIds = [], // Add default empty array
}: SubtopicExplanationParams) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get actual document content if documentIds are provided
    let documentContent = "";
    if (documentIds.length > 0) {
      console.log("🔍 Fetching document content for subtopic explanation:", {
        subtopicName,
        pages,
        documentIds,
      });
      
      const allChunks: any[] = [];
      for (const documentId of documentIds) {
        const chunks = await getDocumentChunks({ documentId });
        const relevantChunks = chunks.filter((chunk) =>
          pages.includes(chunk.page)
        );
        allChunks.push(...relevantChunks);
      }

      if (allChunks.length > 0) {
        documentContent = allChunks
          .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
          .join("\n\n");
        console.log("✅ Found document content:", documentContent.slice(0, 200) + "...");
      } else {
        console.warn("⚠️ No document chunks found for pages:", pages);
      }
    }

    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      system: `You are a supportive AI tutor continuing an ongoing study session. You're helping a student learn from their uploaded document in a natural, conversational way.

Key behaviors:
- Continue the study conversation naturally - don't restart or reintroduce the document
- Use conversational connectors like "Now let's explore...", "Building on that idea...", "Earlier we looked at..."
- Keep your tone warm, encouraging, and human - like a real tutor
- Avoid formal headers, labels, or "summary" language
- Present everything as a natural flow of the study conversation
- Break down complex concepts using everyday language and analogies
- Make concepts relatable and engaging
- Be encouraging and supportive throughout
- Mention specific page references naturally in context
- CRITICAL: Base your explanation ONLY on the actual document content provided below`,
      prompt: `You are continuing an ongoing study session with a student.

You just explained ${parentTopic}. The next subtopic is ${subtopicName}. Connect the two smoothly.

CONTEXT:
- Document: ${documentTitle || "the uploaded document"}
- Pages: ${pages.join(", ")}

${documentContent ? `ACTUAL DOCUMENT CONTENT TO BASE EXPLANATION ON:
${documentContent}

IMPORTANT: Use ONLY the content shown above to explain this subtopic. Do not create generic explanations.` : "No document content available - provide a general explanation."}

Write as if you're continuing a natural conversation.`,
    });

    return { success: true, explanation: text };
  } catch (error) {
    console.error("Failed to generate subtopic explanation:", error);
    return {
      success: false,
      explanation: "Failed to generate explanation. Please try again.",
    };
  }
}
