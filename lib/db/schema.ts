import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
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
    .$type<Record<string, string>>()
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
  suggestedActions: jsonb("suggested_actions").notNull().$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type DocumentSummary = InferSelectModel<typeof documentSummaries>;
export type NewDocumentSummary = InferInsertModel<typeof documentSummaries>;

// Type definitions for enhanced quiz system
export type ChatQuizQuestion = {
  id: string;
  question: string;
  type: "short_answer" | "multiple_choice";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  sourcePage: number;
  difficulty: "easy" | "medium" | "hard";
};
