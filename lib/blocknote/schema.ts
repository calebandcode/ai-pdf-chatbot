import { createBlockSpec } from "@blocknote/core";
import { z } from "zod";

/**
 * Custom block types for our notebook interface
 */

// Question-Answer Block - combines user question and AI response
export const questionAnswerBlockSpec = createBlockSpec(
  {
    type: "questionAnswer",
    propSchema: {
      question: {
        default: "",
      },
      answer: {
        default: "",
      },
      questionId: {
        default: "",
      },
      answerId: {
        default: "",
      },
      documentIds: {
        default: [] as string[],
      },
      isStreaming: {
        default: false,
      },
    },
    content: "inline",
  },
  {
    render: () => {
      // Will be handled by React component
      return null;
    },
  }
);

// Topic Explanation Block - for topic/subtopic explanations
export const topicExplanationBlockSpec = createBlockSpec(
  {
    type: "topicExplanation",
    propSchema: {
      topicName: {
        default: "",
      },
      description: {
        default: "",
      },
      explanation: {
        default: "",
      },
      documentIds: {
        default: [] as string[],
      },
      topicId: {
        default: "",
      },
      parentTopicId: {
        default: null as string | null,
      },
      subtopicIds: {
        default: [] as string[],
      },
      isSubtopic: {
        default: false,
      },
      // New props for interactivity
      collapsed: {
        default: true, // Start collapsed by default
      },
      // Lightweight version history (last 3-5 versions)
      history: {
        default: [] as Array<{
          timestamp: number;
          content: string;
          source: "user" | "ai";
        }>,
      },
      // Loading state for explanation generation
      isGenerating: {
        default: false,
      },
      // Pages reference for this topic
      pages: {
        default: [] as number[],
      },
    },
    content: "inline", // Can contain editable content (explanation text)
  },
  {
    render: () => {
      // Will be handled by React component override
      return null;
    },
  }
);

// Quiz Block - for quiz UI
export const quizBlockSpec = createBlockSpec(
  {
    type: "quiz",
    propSchema: {
      quizId: {
        default: "",
      },
      question: {
        default: {} as any,
      },
      questionNumber: {
        default: 0,
      },
      totalQuestions: {
        default: 0,
      },
    },
    content: "none",
  },
  {
    render: () => {
      return null;
    },
  }
);

// Flashcard Block - for flashcard UI
export const flashcardBlockSpec = createBlockSpec(
  {
    type: "flashcard",
    propSchema: {
      flashcardId: {
        default: "",
      },
      front: {
        default: "",
      },
      back: {
        default: "",
      },
    },
    content: "inline",
  },
  {
    render: () => {
      return null;
    },
  }
);

// Summary Block - for document/topic summaries
export const summaryBlockSpec = createBlockSpec(
  {
    type: "summary",
    propSchema: {
      summary: {
        default: "",
      },
      documentIds: {
        default: [] as string[],
      },
      summaryType: {
        default: "document" as "document" | "topic" | "subtopic",
      },
    },
    content: "inline",
  },
  {
    render: () => {
      return null;
    },
  }
);

// Source Block - for document metadata
export const sourceBlockSpec = createBlockSpec(
  {
    type: "source",
    propSchema: {
      documentId: {
        default: "",
      },
      title: {
        default: "",
      },
      pageCount: {
        default: 0,
      },
      blobUrl: {
        default: "",
      },
    },
    content: "none",
  },
  {
    render: () => {
      return null;
    },
  }
);

// Note Block - for user annotations
export const noteBlockSpec = createBlockSpec(
  {
    type: "note",
    propSchema: {
      noteId: {
        default: "",
      },
      tags: {
        default: [] as string[],
      },
    },
    content: "inline",
  },
  {
    render: () => {
      return null;
    },
  }
);

// Highlight Block - for highlighted text with context
export const highlightBlockSpec = createBlockSpec(
  {
    type: "highlight",
    propSchema: {
      highlightedText: {
        default: "",
      },
      context: {
        default: "",
      },
      sourceDocumentId: {
        default: "",
      },
      sourcePage: {
        default: 0,
      },
    },
    content: "inline",
  },
  {
    render: () => {
      return null;
    },
  }
);

// Export the block specs array for BlockNote configuration
export const customBlockSpecs = [
  questionAnswerBlockSpec,
  topicExplanationBlockSpec,
  quizBlockSpec,
  flashcardBlockSpec,
  summaryBlockSpec,
  sourceBlockSpec,
  noteBlockSpec,
  highlightBlockSpec,
];

// Type exports for TypeScript
export type QuestionAnswerBlock = typeof questionAnswerBlockSpec;
export type TopicExplanationBlock = typeof topicExplanationBlockSpec;
export type QuizBlock = typeof quizBlockSpec;
export type FlashcardBlock = typeof flashcardBlockSpec;
export type SummaryBlock = typeof summaryBlockSpec;
export type SourceBlock = typeof sourceBlockSpec;
export type NoteBlock = typeof noteBlockSpec;
export type HighlightBlock = typeof highlightBlockSpec;

