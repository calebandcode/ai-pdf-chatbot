export type QuizScope = "subtopic" | "topic" | "document";

export type QuizDifficulty = "easy" | "medium" | "hard" | "mixed" | "easy-medium";

export type DocumentQuizConfig = {
  version: number;
  sampling: {
    periodicInterval: number;
    maxSamples: number;
    diversityThreshold: number;
    tokenBudget: number;
    topicCoverage: boolean;
    anchorPages: boolean;
    minimumSnippets: number;
  };
  compression: {
    maxSentences: number;
    maxCharacters: number;
    minSentenceLength: number;
    maxSentenceLength: number;
  };
};

export type SampledSnippet = {
  page: number;
  content: string;
  reason: "anchor" | "periodic" | "topic" | "fallback";
  approxTokens: number;
};

export type CompressedSummary = {
  topicId: string;
  title: string;
  summary: string;
  pages: number[];
  kind: "topic" | "subtopic";
  parentTopicId?: string;
};

export type DocumentQuizDiagnostics = {
  approxTokenCount?: number;
  snippetCount?: number;
  coverageRatio?: number;
  applicationRatio?: number;
  structuralQuestionCount?: number;
  redundantQuestionCount?: number;
  literalQuestionCount?: number;
  intentCounts?: {
    scenario: number;
    conceptual: number;
    recall: number;
  };
  dropCounts?: {
    structural: number;
    redundant: number;
    literal: number;
  };
};

export interface BaseQuizContext {
  scope: QuizScope;
  questionCount: number;
  difficulty: QuizDifficulty;
  documentIds: string[];
  chatId: string;
}

export interface SubtopicQuizContext extends BaseQuizContext {
  scope: "subtopic";
  subtopicName: string;
  subtopicPages: number[];
  parentTopicName: string;
  subtopicContent: string;
  rawContent: string;
  userPerformance?: UserQuizPerformance[];
  conversationContext?: ConversationContext;
  documentTitle?: string;
}

export interface TopicQuizContext extends BaseQuizContext {
  scope: "topic";
  topicName: string;
  topicPages: number[];
  allSubtopics: Array<{
    subtopic: string;
    pages: number[];
  }>;
  topicContent: string;
  rawContent: string;
  userPerformance?: UserQuizPerformance[];
  documentTitle?: string;
}

export interface DocumentQuizContext extends BaseQuizContext {
  scope: "document";
  documentTitle: string;
  allTopics: Array<{
    topic: string;
    description: string;
    pages: number[];
    subtopics?: Array<{
      subtopic: string;
      pages: number[];
    }>;
  }>;
  allPages: number[];
  documentSummary: string;
  userPerformance?: UserQuizPerformance[];
  schemaVersion?: number;
  sampledSnippets?: SampledSnippet[];
  compressedSummaries?: CompressedSummary[];
  generationConfig?: DocumentQuizConfig;
  diagnostics?: DocumentQuizDiagnostics;
  rawContent?: string;
}

export type QuizContext = SubtopicQuizContext | TopicQuizContext | DocumentQuizContext;

export interface UserQuizPerformance {
  quizId: string;
  topic?: string;
  subtopic?: string;
  score: number;
  attemptedAt: Date;
  questionCount: number;
  correctCount: number;
}

export interface ConversationContext {
  topicsCovered: string[];
  currentIndex: number;
  totalTopics: number;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
  difficulty: QuizDifficulty;
  sourcePages: number[];
  type?: "multiple_choice" | "scenario" | "short_answer";
  topicId?: string;
}

export interface QuizResult {
  quizId: string;
  questions: QuizQuestion[];
  title: string;
  scope: QuizScope;
  context: QuizContext;
  diagnostics?: DocumentQuizDiagnostics;
}
