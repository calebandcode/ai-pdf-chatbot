import { generateText } from "ai";
import type { ChatQuizQuestion, DocumentChunk } from "@/lib/db/schema";
import { myProvider } from "./providers";

export type DocumentSummaryResult = {
  summary: string;
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

  const { text } = await generateText({
    model: myProvider.languageModel("chat-model"),
    system: `You are an AI tutor. Generate a concise summary and suggested actions for a PDF document.

Requirements:
- Summary should be 1-2 sentences highlighting the main topic
- Suggested actions should be 4 specific options the user can take
- Always mention the page count
- Be encouraging and helpful

Format your response as JSON:
{
  "summary": "Brief summary of the document",
  "suggestedActions": ["Action 1", "Action 2", "Action 3", "Action 4"]
}`,
    prompt: `Document: "${title}" (${pageCount} pages)

Content preview:
${content.slice(0, 2000)}...

Generate a summary and suggested actions for this document.`,
  });

  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary,
      suggestedActions: parsed.suggestedActions,
      pageCount,
    };
  } catch (_error) {
    // Fallback if JSON parsing fails
    return {
      summary: `I've read "${title}" (${pageCount} pages). This document covers important topics that I can help you explore.`,
      suggestedActions: [
        "Show lesson summaries",
        "Generate practice questions",
        "Create flashcards",
        "Ask specific questions",
      ],
      pageCount,
    };
  }
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
      "type": "short_answer",
      "correctAnswer": "Correct answer",
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
          type: "short_answer" as const,
          correctAnswer: "The main topic",
          explanation: "Based on the content",
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
    system: `You are an AI tutor grading student answers. Be fair but thorough.

Requirements:
- Compare student answer with correct answer semantically
- Consider partial credit for partially correct answers
- Provide helpful feedback
- Always cite the source page

Grading criteria:
- correct: Answer is substantially correct (80%+ accuracy)
- partial: Answer shows understanding but is incomplete (40-79% accuracy)
- incorrect: Answer is mostly wrong or off-topic (<40% accuracy)

Format your response as JSON:
{
  "grade": "correct|partial|incorrect",
  "confidence": 0.85,
  "feedback": "Helpful feedback with encouragement",
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
    system: `Generate 3 engaging questions for interactive chat learning.

Requirements:
- Questions should be short-answer type
- Vary difficulty levels (easy, medium, hard)
- Include page references
- Make questions engaging and educational
- Provide clear explanations

Format your response as JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "type": "short_answer",
      "correctAnswer": "Correct answer",
      "explanation": "Brief explanation",
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
    const parsed = JSON.parse(text);
    return parsed.questions || [];
  } catch (_error) {
    // Fallback questions
    return [
      {
        id: "q1",
        question: "What is the main topic discussed in this section?",
        type: "short_answer" as const,
        correctAnswer: "The main topic",
        explanation: "This is covered in the document",
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
