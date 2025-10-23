"use server";

import { generateText } from "ai";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { getDocumentChunks, saveMessages } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function explainTopic({
  topic,
  pages,
  documentIds,
  chatId,
}: {
  topic: string;
  pages: number[];
  documentIds: string[];
  chatId: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get relevant chunks from the specified pages
    const allChunks: any[] = [];
    for (const documentId of documentIds) {
      const chunks = await getDocumentChunks({ documentId });
      const relevantChunks = chunks.filter((chunk) =>
        pages.includes(chunk.page)
      );
      allChunks.push(...relevantChunks);
    }

    if (allChunks.length === 0) {
      throw new ChatSDKError(
        "not_found:api",
        "No content found for this topic"
      );
    }

    const content = allChunks
      .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
      .join("\n\n");

    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      system: `You are an experienced teacher explaining a specific topic to a student. Be clear, engaging, and educational.

Requirements:
- Explain the topic in simple, understandable terms
- Use examples and analogies when helpful
- Connect concepts to real-world applications
- Mention specific page references
- Be encouraging and supportive
- Keep explanations concise but comprehensive`,
      prompt: `Explain the topic "${topic}" based on this content from pages ${pages.join(", ")}:

${content}

Provide a clear, educational explanation that helps the student understand this topic thoroughly.`,
    });

    // Save the explanation as a message
    await saveMessages({
      messages: [
        {
          id: crypto.randomUUID(),
          chatId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `📚 **Topic Explanation: ${topic}**\n\n${text}\n\n*Source: Pages ${pages.join(", ")}*`,
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    return { success: true, explanation: text };
  } catch (error) {
    console.error("Failed to explain topic:", error);
    throw new ChatSDKError("bad_request:api", "Failed to explain topic");
  }
}

export async function simplifyConcept({
  concept,
  pages,
  documentIds,
  chatId,
}: {
  concept: string;
  pages: number[];
  documentIds: string[];
  chatId: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get relevant chunks from the specified pages
    const allChunks: any[] = [];
    for (const documentId of documentIds) {
      const chunks = await getDocumentChunks({ documentId });
      const relevantChunks = chunks.filter((chunk) =>
        pages.includes(chunk.page)
      );
      allChunks.push(...relevantChunks);
    }

    if (allChunks.length === 0) {
      throw new ChatSDKError(
        "not_found:api",
        "No content found for this concept"
      );
    }

    const content = allChunks
      .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
      .join("\n\n");

    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      system: `You are a patient teacher who specializes in breaking down complex concepts into simple, easy-to-understand explanations.

Requirements:
- Simplify complex concepts using everyday language
- Use analogies, metaphors, and examples
- Break down concepts into smaller, digestible parts
- Avoid jargon and technical terms when possible
- Make it relatable and engaging
- Mention specific page references
- Be encouraging and supportive`,
      prompt: `Simplify the concept "${concept}" based on this content from pages ${pages.join(", ")}:

${content}

Provide a simplified explanation that makes this concept easy to understand, using analogies and examples.`,
    });

    // Save the simplified explanation as a message
    await saveMessages({
      messages: [
        {
          id: crypto.randomUUID(),
          chatId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `💡 **Simplified: ${concept}**\n\n${text}\n\n*Source: Pages ${pages.join(", ")}*`,
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    return { success: true, explanation: text };
  } catch (error) {
    console.error("Failed to simplify concept:", error);
    throw new ChatSDKError("bad_request:api", "Failed to simplify concept");
  }
}
