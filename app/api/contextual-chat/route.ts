import { generateText } from "ai";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";

const ContextualChatSchema = z.object({
  question: z.string().describe("The user's question about the selected text"),
  context: z.object({
    selectedText: z.string().describe("The text the user selected"),
    surroundingContext: z
      .string()
      .describe("The surrounding context/paragraph"),
    sourceTitle: z.string().describe("The title of the source document"),
    sourceType: z
      .enum(["pdf", "website", "text"])
      .describe("The type of source"),
    sourceId: z.string().optional().describe("The ID of the source document"),
  }),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .describe("Previous messages in this conversation"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      question,
      context,
      conversationHistory = [],
    } = ContextualChatSchema.parse(body);

    console.log("🧠 Contextual chat request:", {
      question: question.slice(0, 100),
      selectedText: context.selectedText.slice(0, 50),
      sourceType: context.sourceType,
      sourceTitle: context.sourceTitle,
    });

    // Build the conversation history for context
    const historyContext =
      conversationHistory.length > 0
        ? `\n\nPrevious conversation:\n${conversationHistory
            .map(
              (msg) =>
                `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
            )
            .join("\n")}`
        : "";

    // Generate contextual response
    const response = await generateText({
      model: myProvider.languageModel("chat-model"),
      prompt: `You are an AI tutor helping a student understand specific content they're reading. The student has selected a piece of text and is asking a question about it.

**Context Information:**
- Source: ${context.sourceTitle} (${context.sourceType})
- Selected text: "${context.selectedText}"
- Surrounding context: "${context.surroundingContext}"

**Student's Question:** ${question}${historyContext}

**Instructions:**
1. Focus your answer specifically on the selected text and the student's question
2. Use the surrounding context to provide a more complete explanation
3. Be educational and clear - explain concepts in an accessible way
4. If relevant, reference other parts of the source material
5. Keep your response concise but thorough (2-3 paragraphs max)
6. If this is part of an ongoing conversation, build on previous exchanges

**Your response:**`,
    });

    console.log("✅ Contextual response generated:", {
      responseLength: response.text.length,
      question: question.slice(0, 50),
    });

    return NextResponse.json({
      response: response.text,
      context: {
        selectedText: context.selectedText,
        sourceTitle: context.sourceTitle,
        sourceType: context.sourceType,
      },
    });
  } catch (error) {
    console.error("❌ Error in contextual chat:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
