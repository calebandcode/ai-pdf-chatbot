"use server";

import { generateText } from "ai";
import { myProvider } from "@/lib/ai/providers";

export async function generateTopicExplanationAction(
  topicName: string,
  description: string,
  pages: number[]
) {
  try {
    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      prompt: `You are an AI tutor helping a student understand a topic from their study material.

Topic: ${topicName}
Description: ${description}
Pages: ${pages.join(", ")}

Generate a clear, engaging explanation that:
1. Introduces the topic naturally
2. Explains key concepts in simple terms
3. Makes connections to real-world examples
4. Is conversational and warm

Keep it concise but comprehensive (2-3 paragraphs).`,
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

export async function generateSubtopicExplanationAction(
  parentTopic: string,
  subtopicName: string,
  pages: number[]
) {
  try {
    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      prompt: `You are an AI tutor helping a student understand a subtopic from their study material.

Parent Topic: ${parentTopic}
Subtopic: ${subtopicName}
Pages: ${pages.join(", ")}

Generate a clear, engaging explanation that:
1. Introduces the subtopic in context of the parent topic
2. Explains key concepts in simple terms
3. Makes connections to real-world examples
4. Is conversational and warm

Keep it concise but comprehensive (2-3 paragraphs).`,
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
