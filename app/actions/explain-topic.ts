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
  documentTitle,
  previousTopics = [],
  currentIndex = 0,
  totalTopics = 1,
}: {
  topic: string;
  pages: number[];
  documentIds: string[];
  chatId: string;
  documentTitle?: string;
  previousTopics?: string[];
  currentIndex?: number;
  totalTopics?: number;
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
Current topic: ${topic}
Progress: ${currentIndex + 1} of ${totalTopics}

Content from pages ${pages.join(", ")}:
${content}

Write as if you're continuing a natural conversation. Connect this topic smoothly to what we've already discussed. Use conversational language and end with an engaging question about the next step.`,
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
              text,
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
  documentTitle,
  previousTopics = [],
  currentIndex = 0,
  totalTopics = 1,
}: {
  concept: string;
  pages: number[];
  documentIds: string[];
  chatId: string;
  documentTitle?: string;
  previousTopics?: string[];
  currentIndex?: number;
  totalTopics?: number;
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
      prompt: `Continue the ongoing study session. You're a friendly AI tutor helping a student understand a complex concept.

Document: ${documentTitle || "the uploaded document"}
Previous topics covered: ${previousTopics.length > 0 ? previousTopics.join(", ") : "This is the first topic"}
Current concept: ${concept}
Progress: ${currentIndex + 1} of ${totalTopics}

Content from pages ${pages.join(", ")}:
${content}

Write as if you're continuing a natural conversation. Break down this concept in simple terms using analogies and examples. Connect it smoothly to what we've already discussed. Use conversational language and end with an engaging question about the next step.`,
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
              text,
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
