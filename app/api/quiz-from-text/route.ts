import { generateObject } from "ai";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";

const QuizQuestionSchema = z.object({
  question: z
    .string()
    .describe("A clear, focused question about the selected text"),
  options: z
    .array(z.string())
    .length(4)
    .describe("Four multiple choice options"),
  correctAnswer: z.string().describe("The correct answer from the options"),
  explanation: z
    .string()
    .describe("A brief explanation of why this answer is correct"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .describe("The difficulty level of the question"),
});

const QuizFromTextSchema = z.object({
  questions: z
    .array(QuizQuestionSchema)
    .length(2)
    .describe("Generate exactly 2 quiz questions"),
  summary: z
    .string()
    .describe("A brief summary of what the selected text covers"),
  keyConcepts: z
    .array(z.string())
    .describe("Key concepts covered in the selected text"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, source } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length < 10) {
      return NextResponse.json(
        { error: "Text must be at least 10 characters long" },
        { status: 400 }
      );
    }

    console.log("🧠 Generating quiz from text:", {
      textLength: text.length,
      source,
    });

    const result = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: QuizFromTextSchema,
      prompt: `Generate 2 quiz questions based on this selected text. Make the questions focused, clear, and educational. The questions should test understanding of the key concepts in the text.

Selected text: "${text}"

Source: ${source || "Unknown"}

Generate questions that:
1. Test comprehension of the main ideas
2. Are appropriate for the content level
3. Have clear, unambiguous answers
4. Include helpful explanations
5. Vary in difficulty (one easier, one more challenging)

Focus on the most important concepts and avoid trivial details.`,
    });

    console.log("✅ Quiz generated successfully:", {
      questionsCount: result.object.questions.length,
      summaryLength: result.object.summary.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        questions: result.object.questions,
        summary: result.object.summary,
        keyConcepts: result.object.keyConcepts,
        source: source || "Unknown",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error generating quiz from text:", error);

    return NextResponse.json(
      {
        error: "Failed to generate quiz",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
