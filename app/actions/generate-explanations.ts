"use server";

import { generateText } from "ai";
import { myProvider } from "@/lib/ai/providers";

type TopicExplanationParams = {
  topicName: string;
  description: string;
  pages: number[];
  documentTitle?: string;
  previousTopics?: string[];
  currentIndex?: number;
  totalTopics?: number;
};

export async function generateTopicExplanationAction({
  topicName,
  description,
  pages,
  documentTitle,
  previousTopics = [],
  currentIndex = 0,
  totalTopics = 1,
}: TopicExplanationParams) {
  try {
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
- Mention specific page references naturally in context`,
      prompt: `Continue the ongoing study session. You're a friendly AI tutor guiding a student through their document.

Document: ${documentTitle || "the uploaded document"}
Previous topics covered: ${previousTopics.length > 0 ? previousTopics.join(", ") : "This is the first topic"}
Current topic: ${topicName}
Description: ${description}
Pages: ${pages.join(", ")}
Progress: ${currentIndex + 1} of ${totalTopics}

Write as if you're continuing a natural conversation. Connect this topic smoothly to what we've already discussed. Use conversational language and end with an engaging question about the next step.`,
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
};

export async function generateSubtopicExplanationAction({
  parentTopic,
  subtopicName,
  pages,
  documentTitle,
  previousTopics = [],
  currentIndex = 0,
  totalTopics = 1,
}: SubtopicExplanationParams) {
  try {
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
- Mention specific page references naturally in context`,
      prompt: `Continue the ongoing study session. You're a friendly AI tutor helping a student understand a subtopic.

Document: ${documentTitle || "the uploaded document"}
Previous topics covered: ${previousTopics.length > 0 ? previousTopics.join(", ") : "This is the first topic"}
Parent Topic: ${parentTopic}
Current Subtopic: ${subtopicName}
Pages: ${pages.join(", ")}
Progress: ${currentIndex + 1} of ${totalTopics}

Write as if you're continuing a natural conversation. Break down this subtopic in simple terms using analogies and examples. Connect it smoothly to what we've already discussed. Use conversational language and end with an engaging question about the next step.`,
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
