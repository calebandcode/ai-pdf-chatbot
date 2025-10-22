import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { ChatQuizQuestion, DocumentChunk } from "@/lib/db/schema";
import { myProvider } from "./providers";

export type DocumentSummaryResult = {
  summary: string;
  mainTopics: Array<{
    topic: string;
    description: string;
    pages: number[];
    subtopics?: Array<{
      subtopic: string;
      pages: number[];
    }>;
  }>;
  suggestedActions: string[];
  pageCount: number;
};

export type LessonGenerationResult = {
  title: string;
  summary: string;
  keyTerms: string[];
  sourcePages: number[];
  content: string;
  questions: ChatQuizQuestion[];
  flashcards: Array<{
    front: string;
    back: string;
    sourcePage: number;
  }>;
};

export type AnswerGradeResult = {
  grade: "correct" | "partial" | "incorrect";
  confidence: number;
  feedback: string;
  sourcePage: number;
  isCorrect: boolean;
  explanation: string;
};

/**
 * Generate a document summary and suggested actions after PDF upload
 */
export async function generateDocumentSummary({
  chunks,
  title,
}: {
  chunks: DocumentChunk[];
  title: string;
}): Promise<DocumentSummaryResult> {
  const pageCount = Math.max(...chunks.map((c) => c.page));
  const content = chunks
    .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
    .join("\n\n");
  // Use structured output to avoid JSON parsing failures and generic fallbacks
  const SummarySchema = z.object({
    summary: z
      .string()
      .min(40)
      .describe(
        "2-3 sentences, teacher-like, include the main topic and why it matters for exams, and mention total pages."
      ),
    mainTopics: z
      .array(
        z.object({
          topic: z.string().describe("Main topic name"),
          description: z
            .string()
            .describe("Brief description of what this topic covers"),
          pages: z
            .array(z.number())
            .describe("Page numbers where this topic appears"),
          subtopics: z
            .array(
              z.object({
                subtopic: z.string().describe("Subtopic name"),
                pages: z
                  .array(z.number())
                  .describe("Page numbers for this subtopic"),
              })
            )
            .optional()
            .describe("Key subtopics within this main topic"),
        })
      )
      .min(2)
      .max(8)
      .describe(
        "Main topics covered in the document with their subtopics and page references"
      ),
    suggestedActions: z
      .array(z.string().min(5))
      .min(3)
      .max(6)
      .describe(
        "Concrete learning activities like 'Generate 10 practice questions on X', 'Create flashcards for key terms', 'Explain concept Y with examples', etc."
      ),
  });

  const { object } = await generateObject({
    model: myProvider.languageModel("chat-model"),
    schema: SummarySchema,
    system:
      "You are an experienced AI tutor. Write warm, encouraging, exam-focused guidance. Prefer specific actions over generic ones.",
    prompt: `Analyze this document and produce a comprehensive study-oriented summary with structured topics and concrete actions.

Document title: "${title}"
Total pages: ${pageCount}

Content preview (truncate as needed, do not repeat verbatim):
${content.slice(0, 6000)}

Requirements:
- The summary must sound like a teacher introducing the topic to a student preparing for an exam.
- Mention the total page count explicitly.
- Extract main topics with their descriptions and page references.
- Identify key subtopics within each main topic.
- Avoid generic phrasing like "important topics". Name the main concepts when possible.
- Suggested actions must be click-worthy, actionable options a student can take right now.
- Be specific about page numbers where topics appear.
`,
  });

  return {
    summary: object.summary,
    mainTopics: object.mainTopics,
    suggestedActions: object.suggestedActions,
    pageCount,
  };
}

/**
 * Generate a lesson from document chunks with questions and flashcards
 */
export async function generateLesson({
  chunks,
  documentTitle,
}: {
  chunks: DocumentChunk[];
  documentTitle: string;
}): Promise<LessonGenerationResult> {
  const content = chunks
    .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
    .join("\n\n");

  const { text } = await generateText({
    model: myProvider.languageModel("chat-model"),
    system: `You are an expert AI tutor. Generate a comprehensive lesson from document content.

Requirements:
- Create a focused lesson on a specific topic from the content
- Include 2-sentence summary, key terms, and detailed content
- Generate 3 short-answer questions with explanations and page references
- Create 3 flashcards with front/back pairs
- Always cite source pages for accuracy

Format your response as JSON:
{
  "title": "Lesson title",
  "summary": "2-sentence summary",
  "keyTerms": ["term1", "term2", "term3"],
  "sourcePages": [1, 2, 3],
  "content": "Detailed lesson content",
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "type": "multiple_choice",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correctAnswer": "A",
      "explanation": "Brief explanation",
      "sourcePage": 1,
      "difficulty": "easy"
    }
  ],
  "flashcards": [
    {
      "front": "Front of card",
      "back": "Back of card",
      "sourcePage": 1
    }
  ]
}`,
    prompt: `Generate a lesson from this document content:

Document: "${documentTitle}"

Content:
${content}

Create a focused lesson with questions and flashcards.`,
  });

  try {
    const parsed = JSON.parse(text);
    return {
      title: parsed.title || "Generated Lesson",
      summary:
        parsed.summary || "A lesson covering key concepts from the document.",
      keyTerms: parsed.keyTerms || [],
      sourcePages: parsed.sourcePages || [],
      content: parsed.content || content.slice(0, 1000),
      questions: parsed.questions || [],
      flashcards: parsed.flashcards || [],
    };
  } catch (_error) {
    // Fallback lesson generation
    const sourcePages = [...new Set(chunks.map((c) => c.page))];
    return {
      title: `Lesson from ${documentTitle}`,
      summary:
        "This lesson covers important concepts from your document. Let's explore the key ideas together.",
      keyTerms: ["Key concept 1", "Key concept 2", "Key concept 3"],
      sourcePages,
      content: content.slice(0, 1500),
      questions: [
        {
          id: "q1",
          question: "What is the main topic of this section?",
          type: "multiple_choice" as const,
          options: {
            A: "General overview",
            B: "Specific technical details",
            C: "Historical context",
            D: "Practical applications",
          },
          correctAnswer: "A",
          explanation:
            "Based on the content, this section provides a general overview of the main topic.",
          sourcePage: sourcePages[0] || 1,
          difficulty: "easy" as const,
        },
      ],
      flashcards: [
        {
          front: "Key concept",
          back: "Definition or explanation",
          sourcePage: sourcePages[0] || 1,
        },
      ],
    };
  }
}

/**
 * Grade a student's answer using semantic similarity
 */
export async function gradeAnswer({
  question,
  studentAnswer,
}: {
  question: ChatQuizQuestion;
  studentAnswer: string;
}): Promise<AnswerGradeResult> {
  const { text } = await generateText({
    model: myProvider.languageModel("chat-model"),
    system: `You are an experienced teacher grading a student's answer. Be encouraging, helpful, and educational.

Requirements:
- Compare student answer with correct answer semantically
- Consider partial credit for partially correct answers
- Provide encouraging, teacher-like feedback
- Always cite the source page
- Explain WHY the answer is correct/incorrect
- Give study tips for improvement

Grading criteria:
- correct: Answer is substantially correct (80%+ accuracy)
- partial: Answer shows understanding but is incomplete (40-79% accuracy)
- incorrect: Answer is mostly wrong or off-topic (<40% accuracy)

Format your response as JSON:
{
  "grade": "correct|partial|incorrect",
  "confidence": 0.85,
  "feedback": "Encouraging teacher feedback with explanation",
  "sourcePage": 1
}`,
    prompt: `Question: ${question.question}
Correct Answer: ${question.correctAnswer}
Student Answer: "${studentAnswer}"
Source Page: ${question.sourcePage}
Explanation: ${question.explanation}

Grade the student's answer and provide feedback.`,
  });

  try {
    const parsed = JSON.parse(text);
    return {
      grade: parsed.grade || "partial",
      confidence: parsed.confidence || 0.5,
      feedback:
        parsed.feedback || "Good attempt! Let's review the correct answer.",
      sourcePage: parsed.sourcePage || question.sourcePage,
      isCorrect: parsed.grade === "correct",
      explanation: parsed.feedback || question.explanation,
    };
  } catch (_error) {
    // Simple fallback grading
    const isCorrect = studentAnswer
      .toLowerCase()
      .includes(question.correctAnswer.toLowerCase().split(" ")[0]);

    return {
      grade: isCorrect ? "correct" : "incorrect",
      confidence: isCorrect ? 0.8 : 0.2,
      feedback: isCorrect
        ? "Correct! Well done."
        : `Not quite right. The correct answer is: ${question.correctAnswer}`,
      sourcePage: question.sourcePage,
      isCorrect,
      explanation: isCorrect
        ? "Correct! Well done."
        : `Not quite right. The correct answer is: ${question.correctAnswer}`,
    };
  }
}

/**
 * Generate contextual questions for chat interaction
 */
export async function generateChatQuestions({
  chunks,
}: {
  chunks: DocumentChunk[];
}): Promise<ChatQuizQuestion[]> {
  const content = chunks
    .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
    .join("\n\n");

  const { text } = await generateText({
    model: myProvider.languageModel("chat-model"),
    system: `Generate 3 engaging multiple choice questions for interactive classroom learning.

Requirements:
- Questions should be multiple choice with 4 options (A, B, C, D)
- Vary difficulty levels (easy, medium, hard)
- Include page references
- Make questions engaging and educational like a real teacher would ask
- Provide clear, educational explanations
- One correct answer and 3 plausible distractors that test understanding
- Questions should test comprehension, not just memorization

Format your response as JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "type": "multiple_choice",
      "options": {
        "A": "Option A",
        "B": "Option B", 
        "C": "Option C",
        "D": "Option D"
      },
      "correctAnswer": "A",
      "explanation": "Educational explanation of why this is correct and what students should learn",
      "sourcePage": 1,
      "difficulty": "easy"
    }
  ]
}`,
    prompt: `Generate interactive questions from this content:

${content}

Create 3 questions that will help the student learn effectively.`,
  });

  try {
    // Some models return JSON wrapped in ```json ... ``` fences; strip them safely
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned);
    console.log("Generated questions:", parsed.questions);

    // Validate and ensure all questions are multiple choice
    const validatedQuestions = (parsed.questions || []).map((q: any) => {
      if (q.type !== "multiple_choice" || !q.options) {
        console.warn("Converting non-multiple-choice question to MCQ:", q);
        return {
          id: q.id || "q1",
          question:
            q.question || "What is the main topic discussed in this section?",
          type: "multiple_choice" as const,
          options: {
            A: "General overview",
            B: "Specific technical details",
            C: "Historical context",
            D: "Practical applications",
          },
          correctAnswer: "A",
          explanation:
            q.explanation ||
            "This question covers the main concepts from the document.",
          sourcePage: q.sourcePage || chunks[0]?.page || 1,
          difficulty: q.difficulty || ("easy" as const),
        };
      }
      return q;
    });

    return validatedQuestions;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.log("Raw AI response:", text);

    // Fallback questions with better content
    return [
      {
        id: "q1",
        question: "Based on the document content, what is the primary focus?",
        type: "multiple_choice" as const,
        options: {
          A: "General overview",
          B: "Specific technical details",
          C: "Historical context",
          D: "Practical applications",
        },
        correctAnswer: "A",
        explanation:
          "The document provides a comprehensive overview of the main topic, covering key concepts and important details.",
        sourcePage: chunks[0]?.page || 1,
        difficulty: "easy" as const,
      },
    ];
  }
}

/**
 * Generate contextual response using document content
 */
export async function generateContextualResponse({
  question,
  chunks,
}: {
  question: string;
  chunks: DocumentChunk[];
}): Promise<{
  response: string;
  citations: Array<{ page: number; content: string }>;
}> {
  const relevantChunks = chunks.slice(0, 5); // Use top 5 most relevant chunks
  const context = relevantChunks
    .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
    .join("\n\n");

  const { text } = await generateText({
    model: myProvider.languageModel("chat-model"),
    system: `You are a helpful AI tutor. Answer questions using the provided document content.

Requirements:
- Always base your answer on the document content
- Cite specific page numbers when making claims
- Be concise but thorough
- If the question isn't fully answerable from the document, say so
- End with a follow-up question to engage the student

Format your response as JSON:
{
  "response": "Your answer with page citations",
  "citations": [
    {
      "page": 1,
      "content": "Relevant excerpt from the page"
    }
  ]
}`,
    prompt: `Question: ${question}

Document content:
${context}

Answer the question using the document content and provide citations.`,
  });

  try {
    const parsed = JSON.parse(text);
    return {
      response:
        parsed.response ||
        "I need more information to answer that question accurately.",
      citations: parsed.citations || [],
    };
  } catch (_error) {
    return {
      response:
        text ||
        "I'd be happy to help answer your question based on the document content.",
      citations: relevantChunks.map((chunk) => ({
        page: chunk.page,
        content: chunk.content.slice(0, 200),
      })),
    };
  }
}
