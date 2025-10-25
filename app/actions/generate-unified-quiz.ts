"use server";

import { generateObject } from "ai";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { getDocumentChunks } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { z } from "zod";
import { 
  QuizContext, 
  QuizResult, 
  QuizQuestion, 
  QuizScope,
  SubtopicQuizContext,
  TopicQuizContext,
  DocumentQuizContext
} from "@/lib/types/quiz";

const QuizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  correct: z.string(),
  explanation: z.string(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed", "easy-medium"]),
  sourcePages: z.array(z.number()),
});

const QuizResultSchema = z.object({
  quizId: z.string(),
  questions: z.array(QuizQuestionSchema),
  title: z.string(),
  scope: z.enum(["subtopic", "topic", "document"]),
  context: z.object({
    scope: z.string(),
    questionCount: z.number(),
    difficulty: z.string(),
  }),
});

function buildQuizPrompt(context: QuizContext): string {
  const basePrompt = `You are an expert AI study tutor creating contextual quiz questions. Your goal is to generate questions that test understanding of the specific content provided, not generic questions.

CRITICAL: Generate questions in the SAME LANGUAGE as the document content. If the document is in Spanish, generate Spanish questions. If in English, generate English questions.

IMPORTANT: You MUST ONLY create questions based on the specific content provided below. Do NOT create generic questions about the topic. Every question must be directly related to the actual content shown.

Key principles:
- Questions must be directly related to the provided content
- Use conversational, engaging language IN THE SAME LANGUAGE as the document
- Vary difficulty levels appropriately
- Include practical applications when possible
- Provide clear explanations for learning IN THE SAME LANGUAGE as the document
- Reference specific page numbers naturally
- Maintain the document's language throughout all questions and explanations
- DO NOT create generic questions - only use the specific content provided`;

  switch (context.scope) {
    case "subtopic":
      return `${basePrompt}

CONTEXT: Subtopic Quiz
- Document: "${context.documentTitle || 'Unknown Document'}"
- Subtopic: "${context.subtopicName}"
- Parent Topic: "${context.parentTopicName}"
- Pages: ${context.subtopicPages.join(", ")}
- Question Count: ${context.questionCount}
- Difficulty: ${context.difficulty}

CONTENT TO BASE QUESTIONS ON:
${context.subtopicContent}

RAW DOCUMENT CONTENT:
${context.rawContent}

Generate ${context.questionCount} focused questions about "${context.subtopicName}". Questions should test understanding of the specific concepts covered in this subtopic. IMPORTANT: Generate all questions, options, and explanations in the same language as the document content.

CRITICAL: Base your questions ONLY on the content shown above. Do not create generic questions about ${context.subtopicName} - use the actual content provided.`;

    case "topic":
      return `${basePrompt}

CONTEXT: Topic Quiz
- Document: "${context.documentTitle || 'Unknown Document'}"
- Topic: "${context.topicName}"
- Pages: ${context.topicPages.join(", ")}
- Question Count: ${context.questionCount}
- Difficulty: ${context.difficulty}

SUBTTOPICS COVERED:
${context.allSubtopics.map(st => `- ${st.subtopic} (pages ${st.pages.join(", ")})`).join("\n")}

TOPIC CONTENT:
${context.topicContent}

RAW DOCUMENT CONTENT:
${context.rawContent}

Generate ${context.questionCount} comprehensive questions about "${context.topicName}". Questions should cover all subtopics and test overall understanding of the topic. IMPORTANT: Generate all questions, options, and explanations in the same language as the document content.

CRITICAL: Base your questions ONLY on the content shown above. Do not create generic questions about ${context.topicName} - use the actual content provided.`;

    case "document":
      return `${basePrompt}

CONTEXT: Document Quiz
- Document: "${context.documentTitle}"
- Pages: ${context.allPages.join(", ")}
- Question Count: ${context.questionCount}
- Difficulty: ${context.difficulty}

TOPICS COVERED:
${context.allTopics.map(t => `- ${t.topic} (pages ${t.pages.join(", ")})`).join("\n")}

DOCUMENT SUMMARY:
${context.documentSummary}

Generate ${context.questionCount} comprehensive questions about "${context.documentTitle}". Questions should test overall mastery of the document content across all topics.`;

    default:
      throw new Error(`Unsupported quiz scope: ${(context as any).scope}`);
  }
}

function generateQuizId(): string {
  return `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function generateUnifiedQuiz(context: QuizContext): Promise<QuizResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get raw content from document chunks if not provided
    let rawContent = "";
    if (context.scope === "subtopic") {
      const ctx = context as SubtopicQuizContext;
      if (!ctx.rawContent) {
        console.log("🔍 Fetching chunks for subtopic:", {
          documentId: context.documentIds[0],
          subtopicPages: ctx.subtopicPages,
        });
        const chunks = await getDocumentChunks({ documentId: context.documentIds[0] });
        console.log("🔍 Retrieved chunks:", {
          totalChunks: chunks.length,
          chunkPages: chunks.map(c => c.page),
          firstChunkContent: chunks[0]?.content?.slice(0, 100) + "...",
        });
        const relevantChunks = chunks.filter(chunk => 
          ctx.subtopicPages.includes(chunk.page)
        );
        console.log("🔍 Relevant chunks for subtopic:", {
          relevantChunksCount: relevantChunks.length,
          relevantPages: relevantChunks.map(c => c.page),
        });
        rawContent = relevantChunks
          .map(chunk => `Page ${chunk.page}: ${chunk.content}`)
          .join("\n\n");
      } else {
        rawContent = ctx.rawContent;
      }
    } else if (context.scope === "topic") {
      const ctx = context as TopicQuizContext;
      if (!ctx.rawContent) {
        console.log("🔍 Fetching chunks for topic:", {
          documentId: context.documentIds[0],
          topicPages: ctx.topicPages,
        });
        const chunks = await getDocumentChunks({ documentId: context.documentIds[0] });
        console.log("🔍 Retrieved chunks:", {
          totalChunks: chunks.length,
          chunkPages: chunks.map(c => c.page),
          firstChunkContent: chunks[0]?.content?.slice(0, 100) + "...",
        });
        const relevantChunks = chunks.filter(chunk => 
          ctx.topicPages.includes(chunk.page)
        );
        console.log("🔍 Relevant chunks for topic:", {
          relevantChunksCount: relevantChunks.length,
          relevantPages: relevantChunks.map(c => c.page),
        });
        rawContent = relevantChunks
          .map(chunk => `Page ${chunk.page}: ${chunk.content}`)
          .join("\n\n");
      } else {
        rawContent = ctx.rawContent;
      }
    } else if (context.scope === "document") {
      const ctx = context as DocumentQuizContext;
      console.log("🔍 Fetching chunks for document:", {
        documentId: context.documentIds[0],
        allPages: ctx.allPages,
      });
      const chunks = await getDocumentChunks({ documentId: context.documentIds[0] });
      console.log("🔍 Retrieved chunks:", {
        totalChunks: chunks.length,
        chunkPages: chunks.map(c => c.page),
        firstChunkContent: chunks[0]?.content?.slice(0, 100) + "...",
      });
      const relevantChunks = chunks.filter(chunk => 
        ctx.allPages.includes(chunk.page)
      );
      console.log("🔍 Relevant chunks for document:", {
        relevantChunksCount: relevantChunks.length,
        relevantPages: relevantChunks.map(c => c.page),
      });
      rawContent = relevantChunks
        .map(chunk => `Page ${chunk.page}: ${chunk.content}`)
        .join("\n\n");
    }

    // Update context with raw content
    const enrichedContext = { ...context, rawContent };
    
    // Debug: Log the content being passed to AI
    console.log("🔍 Quiz Generation Debug:", {
      scope: context.scope,
      documentTitle: context.documentTitle,
      rawContentLength: rawContent.length,
      rawContentPreview: rawContent.slice(0, 200) + "...",
      subtopicContent: context.scope === "subtopic" ? (context as SubtopicQuizContext).subtopicContent.slice(0, 100) + "..." : "N/A",
      topicContent: context.scope === "topic" ? (context as TopicQuizContext).topicContent.slice(0, 100) + "..." : "N/A",
      documentIds: context.documentIds,
    });
    
    // Check if we have any content at all
    if (rawContent.length === 0) {
      console.error("❌ NO RAW CONTENT FOUND! This will cause generic questions.");
      // Fallback: Use the processed content from TopicOutline
      if (context.scope === "subtopic") {
        const ctx = context as SubtopicQuizContext;
        rawContent = ctx.subtopicContent || "No content available";
        console.log("🔄 Using subtopic content as fallback:", rawContent.slice(0, 100) + "...");
      } else if (context.scope === "topic") {
        const ctx = context as TopicQuizContext;
        rawContent = ctx.topicContent || "No content available";
        console.log("🔄 Using topic content as fallback:", rawContent.slice(0, 100) + "...");
      }
    }
    if (context.scope === "subtopic" && (context as SubtopicQuizContext).subtopicContent.length === 0) {
      console.error("❌ NO SUBTOPIC CONTENT FOUND!");
    }
    if (context.scope === "topic" && (context as TopicQuizContext).topicContent.length === 0) {
      console.error("❌ NO TOPIC CONTENT FOUND!");
    }

    const prompt = buildQuizPrompt(enrichedContext);
    
    const result = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: QuizResultSchema,
      prompt,
      system: `You are an expert AI study tutor. Generate quiz questions that are:
1. Directly related to the provided content
2. Appropriately difficult for the scope
3. Educational and engaging
4. Include practical applications
5. Have clear explanations
6. CRITICAL: Generate ALL content (questions, options, explanations) in the SAME LANGUAGE as the document

IMPORTANT: You MUST ONLY create questions based on the specific content provided in the prompt. Do NOT create generic questions about the topic. Every question must be directly related to the actual content shown.

Each question should have:
- A clear, engaging prompt IN THE DOCUMENT'S LANGUAGE
- Exactly 4 multiple choice options labeled A, B, C, D IN THE DOCUMENT'S LANGUAGE
- One correct answer (must be A, B, C, or D)
- A helpful explanation IN THE DOCUMENT'S LANGUAGE
- Appropriate difficulty level
- Source page references

CRITICAL: Base your questions ONLY on the content provided in the prompt. Do not create generic questions - use the actual content shown.

IMPORTANT: The options object must have exactly 4 keys: A, B, C, D. Each key should contain the option text IN THE DOCUMENT'S LANGUAGE.

Generate exactly the requested number of questions.`,
    });

    const quizId = generateQuizId();
    const title = getQuizTitle(context);

    return {
      quizId,
      questions: result.object.questions,
      title,
      scope: context.scope,
      context: enrichedContext
    };

  } catch (error) {
    console.error("Error generating unified quiz:", error);
    throw new ChatSDKError(
      "offline:api",
      "Failed to generate quiz questions"
    );
  }
}

function getQuizTitle(context: QuizContext): string {
  switch (context.scope) {
    case "subtopic":
      return `Quiz: ${context.subtopicName}`;
    case "topic":
      return `Quiz: ${context.topicName}`;
    case "document":
      return `Quiz: ${context.documentTitle}`;
    default:
      return "Quiz";
  }
}
