import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
  difficultyLevel: varchar("difficultyLevel", {
    enum: ["age12", "age15", "university"],
  })
    .notNull()
    .default("university"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet", "quiz"] })
      .notNull()
      .default("text"),
    metadata: jsonb("metadata").default(null),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  blobUrl: text("blob_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type IngestedDocument = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;

export const docChunks = pgTable(
  "doc_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    tokens: integer("tokens"),
  },
  (table) => ({
    uniqDocPageContent: uniqueIndex("uniq_doc_page_content").on(
      table.documentId,
      table.page,
      table.content
    ),
  })
);

export type DocumentChunk = InferSelectModel<typeof docChunks>;
export type NewDocumentChunk = InferInsertModel<typeof docChunks>;

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  topic: text("topic"),
  difficulty: text("difficulty", { enum: ["easy", "hard"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Quiz = InferSelectModel<typeof quizzes>;
export type NewQuiz = InferInsertModel<typeof quizzes>;

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  difficulty: text("difficulty", { enum: ["easy", "hard"] }).notNull(),
  options: jsonb("options").notNull(),
  correct: text("correct").notNull(),
  explanation: text("explanation").notNull(),
  rationales: jsonb("rationales").notNull(),
  sourceRefs: jsonb("source_refs").notNull(),
  memoryStability: doublePrecision("memory_stability").default(0),
  memoryDifficulty: doublePrecision("memory_difficulty").default(0),
  elapsedDays: integer("elapsed_days").default(0),
  scheduledDays: integer("scheduled_days").default(0),
  lastReview: timestamp("last_review", { withTimezone: true }),
  reps: integer("reps").default(0),
  state: integer("state").default(0),
});

export type Question = InferSelectModel<typeof questions>;
export type NewQuestion = InferInsertModel<typeof questions>;

export const attempts = pgTable("attempts", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  scorePct: integer("score_pct"),
});

export type Attempt = InferSelectModel<typeof attempts>;
export type NewAttempt = InferInsertModel<typeof attempts>;

export const answers = pgTable("answers", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  chosenOptionId: text("chosen_option_id"),
  isCorrect: boolean("is_correct"),
  feedback: text("feedback"),
});

export type Answer = InferSelectModel<typeof answers>;
export type NewAnswer = InferInsertModel<typeof answers>;

// Enhanced schema for AI PDF Chatbot
export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  keyTerms: jsonb("key_terms").notNull().$type<string[]>(),
  sourcePages: jsonb("source_pages").notNull().$type<number[]>(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Lesson = InferSelectModel<typeof lessons>;
export type NewLesson = InferInsertModel<typeof lessons>;

export const flashcards = pgTable("flashcards", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  sourcePage: integer("source_page").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Flashcard = InferSelectModel<typeof flashcards>;
export type NewFlashcard = InferInsertModel<typeof flashcards>;

export const chatQuizzes = pgTable("chat_quizzes", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  questions: jsonb("questions").notNull().$type<ChatQuizQuestion[]>(),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  answers: jsonb("answers")
    .notNull()
    .$type<Record<string, string | null>>()
    .default({}),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ChatQuiz = InferSelectModel<typeof chatQuizzes>;
export type NewChatQuiz = InferInsertModel<typeof chatQuizzes>;

export const documentSummaries = pgTable("document_summaries", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  mainTopics:
    jsonb("main_topics").$type<
      Array<{
        topic: string;
        description: string;
        pages: number[];
        subtopics?: Array<{
          subtopic: string;
          pages: number[];
        }>;
      }>
    >(),
  suggestedActions: jsonb("suggested_actions").notNull().$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type DocumentSummary = InferSelectModel<typeof documentSummaries>;
export type NewDocumentSummary = InferInsertModel<typeof documentSummaries>;

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  sourceType: varchar("source_type", {
    enum: ["pdf", "link", "youtube"],
  })
    .notNull()
    .default("pdf"),
  sourceUrl: text("source_url"),
  totalXp: integer("total_xp").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Course = InferSelectModel<typeof courses>;
export type NewCourse = InferInsertModel<typeof courses>;

export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  isUnlocked: boolean("is_unlocked").default(false).notNull(),
  slideCount: integer("slide_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Unit = InferSelectModel<typeof units>;
export type NewUnit = InferInsertModel<typeof units>;

export const unitSlides = pgTable("unit_slides", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  type: varchar("type", { enum: ["learn", "quiz"] }).notNull(),
  content: jsonb("content").notNull(),
  citation: text("citation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UnitSlide = InferSelectModel<typeof unitSlides>;
export type NewUnitSlide = InferInsertModel<typeof unitSlides>;

export const userProgress = pgTable("user_progress", {
  userId: text("user_id").primaryKey().notNull(),
  totalXp: integer("total_xp").default(0).notNull(),
  hearts: integer("hearts").default(5).notNull(),
  streakCurrent: integer("streak_current").default(0).notNull(),
  streakBest: integer("streak_best").default(0).notNull(),
  lastPlayedDate: timestamp("last_played_date", { withTimezone: true }),
  unlockedUnits: jsonb("unlocked_units")
    .$type<Record<string, number>>()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserProgress = InferSelectModel<typeof userProgress>;
export type NewUserProgress = InferInsertModel<typeof userProgress>;

export const chatContexts = pgTable("chat_contexts", {
  chatId: uuid("chat_id")
    .primaryKey()
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  sources: jsonb("sources")
    .notNull()
    .$type<
      Array<{
        documentId: string;
        title: string;
        summary: string;
        mainTopics?: Array<{
          topic: string;
          description?: string;
          pages?: number[];
          subtopics?: Array<{
            subtopic: string;
            description?: string;
            pages?: number[];
          }>;
        }>;
      }>
    >()
    .default([]),
  globalSummary: text("global_summary").notNull().default(""),
  globalTopics: jsonb("global_topics")
    .notNull()
    .$type<
      Array<{
        topic: string;
        description?: string;
        pages?: number[];
        subtopics?: Array<{
          subtopic: string;
          description?: string;
          pages?: number[];
        }>;
      }>
    >()
    .default([]),
  // New fields for intelligent merging (Step 1)
  relationships: jsonb("relationships")
    .$type<
      Array<{
        sourceId1: string;
        sourceId2: string;
        type: "complementary" | "expands" | "contradictory" | "repeats";
        description: string;
        confidence: number;
        topics: string[];
      }>
    >()
    .default([]),
  sourceCount: integer("source_count").default(0),
  lastSummaryRegeneration: timestamp("last_summary_regeneration", {
    withTimezone: true,
  }),
  deltaSummaries: jsonb("delta_summaries")
    .$type<
      Array<{
        sourceId: string;
        sourceTitle: string;
        delta: string;
        addedAt: string;
      }>
    >()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ChatContext = InferSelectModel<typeof chatContexts>;
export type NewChatContext = InferInsertModel<typeof chatContexts>;

// Topic embeddings table for vector similarity search
export const topicEmbeddings = pgTable(
  "topic_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull(),
    topicId: varchar("topic_id", { length: 255 }).notNull(),
    topicTitle: text("topic_title").notNull(),
    topicDescription: text("topic_description"),
    embedding: vector("embedding", { dimensions: 1536 }),
    topicData: jsonb("topic_data").notNull().$type<{
      topic: string;
      description?: string;
      pages?: number[];
      subtopics?: Array<{
        subtopic: string;
        description?: string;
        pages?: number[];
      }>;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqChatTopic: uniqueIndex("uniq_chat_topic").on(
      table.chatId,
      table.topicId
    ),
  })
);

export type TopicEmbedding = InferSelectModel<typeof topicEmbeddings>;
export type NewTopicEmbedding = InferInsertModel<typeof topicEmbeddings>;

// BlockNote blocks table for persistent notebook editing
export const notebookBlocks = pgTable("notebook_blocks", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  blockType: varchar("block_type", { length: 50 }).notNull(), // questionAnswer, topicExplanation, summary, note, etc.
  blockOrder: integer("block_order").notNull().default(0), // Order within the chat
  blockData: jsonb("block_data").notNull().$type<{
    // BlockNote block structure
    type: string;
    props?: Record<string, unknown>;
    content?: unknown;
  }>(),
  metadata: jsonb("metadata").$type<{
    // Additional metadata for block actions
    pinned?: boolean;
    tags?: string[];
    linkedBlockIds?: string[];
    collapsed?: boolean;
    parentBlockId?: string | null; // For hierarchical structures (topics/subtopics)
    topicId?: string;
    subtopicId?: string;
    documentIds?: string[];
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  // Indexes for performance (chats can have many blocks)
  chatIdIdx: index("notebook_blocks_chat_id_idx").on(table.chatId),
  blockOrderIdx: index("notebook_blocks_block_order_idx").on(table.chatId, table.blockOrder),
}));

export type NotebookBlock = InferSelectModel<typeof notebookBlocks>;
export type NewNotebookBlock = InferInsertModel<typeof notebookBlocks>;

// Tutor Session schema for guided learning
export const tutorSession = pgTable("tutor_sessions", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull().$type<{
    topicId: string;
    subtopicId?: string;
    step: "explain" | "quiz" | "remediate" | "advance" | "completed";
    progress: {
      totalAsked: number;
      totalCorrect: number;
      currentTopicAccuracy: number;
    };
    startedAt: string;
    currentPages: number[];
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TutorSession = InferSelectModel<typeof tutorSession>;
export type NewTutorSession = InferInsertModel<typeof tutorSession>;

// Type definitions for enhanced quiz system
export type ChatQuizQuestion = {
  id: string;
  question: string;
  type: "short_answer" | "multiple_choice";
  options?: Record<string, string>; // For multiple choice: { "A": "Option A", "B": "Option B", ... }
  correctAnswer: string;
  explanation: string;
  sourcePage: number;
  difficulty: "easy" | "medium" | "hard";
};

// Saved blocks table for user-curated notebook content
export const savedBlocks = pgTable(
  "saved_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    blockType: varchar("block_type", { length: 50 }).notNull(), // 'explanation' | 'qa' | 'summary' | 'definition' | 'note'
    content: text("content").notNull(), // The saved content (text)
    question: text("question"), // For Q&A blocks: the question
    answer: text("answer"), // For Q&A blocks: the answer
    topicName: text("topic_name"), // Optional: topic this block belongs to
    subtopicName: text("subtopic_name"), // Optional: subtopic this block belongs to
    sourceMessageId: uuid("source_message_id").references(() => message.id, {
      onDelete: "set null",
    }), // Reference to original message
    documentIds: jsonb("document_ids").$type<string[]>().default([]), // Source document IDs
    metadata: jsonb("metadata").$type<{
      pageNumbers?: number[];
      confidence?: number;
      tags?: string[];
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    chatIdIdx: index("saved_blocks_chat_id_idx").on(table.chatId),
    topicIdx: index("saved_blocks_topic_idx").on(table.chatId, table.topicName),
    messageIdIdx: index("saved_blocks_message_id_idx").on(table.sourceMessageId),
  })
);

export type SavedBlock = InferSelectModel<typeof savedBlocks>;
export type NewSavedBlock = InferInsertModel<typeof savedBlocks>;
