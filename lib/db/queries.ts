import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import { generateUUID } from "../utils";
import {
  type Answer,
  type Attempt,
  answers,
  attempts,
  type Chat,
  type ChatQuiz,
  chat,
  chatQuizzes,
  type DBMessage,
  type DocumentChunk,
  type DocumentSummary,
  docChunks,
  document,
  documentSummaries,
  documents,
  type Flashcard,
  flashcards,
  type IngestedDocument,
  type Lesson,
  lessons,
  message,
  type NewAnswer,
  type NewAttempt,
  type NewDocument,
  type NewDocumentChunk,
  type NewQuestion,
  type NewQuiz,
  type Question,
  type Quiz,
  questions,
  quizzes,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    console.warn("Database not configured, skipping chat save:", error);
    return [];
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error("❌ Database query failed for getChatsByUserId:", error);
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to get chats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    console.error("❌ Database query failed for getChatById:", error);
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to get chat: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error("❌ Database operation failed for saveMessages:", error);
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to save messages: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error("❌ Database query failed for getMessagesByChatId:", error);
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to get messages: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  metadata,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        metadata: metadata ?? null,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const docResults = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return docResults;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    console.warn("Database not configured, using mock data:", error);
    return 0;
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    console.warn("Database not configured, skipping stream creation:", error);
    // No-op for development without database
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

export async function createDocumentRecord({
  userId,
  title,
  blobUrl,
}: Pick<
  NewDocument,
  "userId" | "title" | "blobUrl"
>): Promise<IngestedDocument> {
  try {
    const [inserted] = await db
      .insert(documents)
      .values({ userId, title, blobUrl })
      .returning();

    return inserted;
  } catch (error) {
    console.warn("Database not configured, using mock data:", error);

    // Return mock document for development
    return {
      id: generateUUID(),
      userId,
      title,
      blobUrl,
      createdAt: new Date(),
    };
  }
}

export async function getDocumentRecordById({
  id,
}: {
  id: string;
}): Promise<IngestedDocument | undefined> {
  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)
      .execute();

    return doc;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch document record"
    );
  }
}

export async function getDocumentRecordsByIds({
  ids,
  userId,
}: {
  ids: string[];
  userId: string;
}): Promise<IngestedDocument[]> {
  if (!ids.length) {
    return [];
  }

  try {
    const docs = await db
      .select()
      .from(documents)
      .where(and(inArray(documents.id, ids), eq(documents.userId, userId)))
      .orderBy(desc(documents.createdAt));

    return docs;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch document records"
    );
  }
}

export async function saveDocumentChunks({
  documentId,
  chunks,
}: {
  documentId: string;
  chunks: Omit<NewDocumentChunk, "documentId">[];
}): Promise<DocumentChunk[]> {
  if (chunks.length === 0) {
    return [];
  }

  try {
    const inserted = await db
      .insert(docChunks)
      .values(
        chunks.map((chunk) => ({
          ...chunk,
          documentId,
        }))
      )
      .onConflictDoNothing()
      .returning();

    return inserted;
  } catch (error) {
    console.warn("Database not configured, using mock data:", error);

    // Return mock chunks for development
    return chunks.map((chunk) => ({
      id: generateUUID(),
      documentId,
      page: chunk.page,
      content: chunk.content,
      embedding: chunk.embedding ?? null,
      tokens: chunk.tokens ?? null,
    }));
  }
}

export async function ensureDocChunksVectorIndex({
  lists = 100,
}: {
  lists?: number;
} = {}): Promise<void> {
  try {
    // Parameterizing the lists value causes a SQL error ("$1") in Postgres/Neon for WITH (lists = ...)
    // Build the statement with an inlined integer instead.
    const inlineLists =
      Number.isFinite(lists) && lists > 0 ? Math.floor(lists) : 100;
    await db.execute(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = ${inlineLists});`
      )
    );
  } catch (error) {
    console.warn("Failed to ensure doc_chunks embedding index", error);
  }
}

export async function createQuizRecord(
  quiz: Pick<NewQuiz, "userId" | "title" | "topic" | "difficulty">
): Promise<Quiz> {
  try {
    const [inserted] = await db.insert(quizzes).values(quiz).returning();
    return inserted;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create quiz");
  }
}

export async function saveQuizQuestions({
  quizId,
  questions: quizQuestions,
}: {
  quizId: string;
  questions: Omit<NewQuestion, "quizId">[];
}): Promise<Question[]> {
  if (quizQuestions.length === 0) {
    return [];
  }

  try {
    const inserted = await db
      .insert(questions)
      .values(
        quizQuestions.map((question) => ({
          ...question,
          quizId,
        }))
      )
      .returning();

    return inserted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save quiz questions"
    );
  }
}

export async function createQuizAttempt(
  attempt: Pick<
    NewAttempt,
    "quizId" | "userId" | "startedAt" | "submittedAt" | "scorePct"
  >
): Promise<Attempt> {
  try {
    const [inserted] = await db.insert(attempts).values(attempt).returning();
    return inserted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create quiz attempt"
    );
  }
}

export async function saveQuizAnswers({
  answers: attemptAnswers,
}: {
  answers: NewAnswer[];
}): Promise<Answer[]> {
  if (attemptAnswers.length === 0) {
    return [];
  }

  try {
    const inserted = await db
      .insert(answers)
      .values(attemptAnswers)
      .returning();
    return inserted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save quiz answers"
    );
  }
}

export async function getQuizById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Quiz | undefined> {
  try {
    const [quizRecord] = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)))
      .limit(1)
      .execute();

    return quizRecord;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch quiz");
  }
}

export async function getQuestionsByQuizId({
  quizId,
}: {
  quizId: string;
}): Promise<Question[]> {
  try {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(asc(questions.id))
      .execute();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch quiz questions"
    );
  }
}

// Enhanced AI PDF Chatbot queries
export async function createDocumentSummary({
  documentId,
  summary,
  mainTopics,
  suggestedActions,
}: {
  documentId: string;
  summary: string;
  mainTopics?: Array<{
    topic: string;
    description: string;
    pages: number[];
    subtopics?: Array<{
      subtopic: string;
      pages: number[];
    }>;
  }>;
  suggestedActions: string[];
}): Promise<DocumentSummary> {
  try {
    const [result] = await db
      .insert(documentSummaries)
      .values({
        documentId,
        summary,
        mainTopics,
        suggestedActions,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create document summary");
    }

    return result;
  } catch (error) {
    console.warn("Database not configured, using mock data:", error);

    // Return mock summary for development
    return {
      id: generateUUID(),
      documentId,
      summary,
      mainTopics: mainTopics || null,
      suggestedActions,
      createdAt: new Date(),
    };
  }
}

export async function getDocumentSummary({
  documentId,
}: {
  documentId: string;
}): Promise<DocumentSummary | null> {
  try {
    const [result] = await db
      .select()
      .from(documentSummaries)
      .where(eq(documentSummaries.documentId, documentId))
      .orderBy(desc(documentSummaries.createdAt))
      .limit(1)
      .execute();

    return result || null;
  } catch (error) {
    console.warn("Database not configured, using mock data:", error);

    // Return mock summary for development
    return {
      id: generateUUID(),
      documentId,
      summary: `I've read the document (${documentId.slice(0, 8)}...). This document covers important topics that I can help you explore.`,
      mainTopics: null,
      suggestedActions: [
        "Show lesson summaries",
        "Generate practice questions",
        "Create flashcards",
        "Ask specific questions",
      ],
      createdAt: new Date(),
    };
  }
}

export async function createLesson({
  documentId,
  userId,
  title,
  summary,
  keyTerms,
  sourcePages,
  content,
}: {
  documentId: string;
  userId: string;
  title: string;
  summary: string;
  keyTerms: string[];
  sourcePages: number[];
  content: string;
}): Promise<Lesson> {
  try {
    const [result] = await db
      .insert(lessons)
      .values({
        documentId,
        userId,
        title,
        summary,
        keyTerms,
        sourcePages,
        content,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create lesson");
    }

    return result;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create lesson");
  }
}

export async function getLessonsByDocumentId({
  documentId,
  userId,
}: {
  documentId: string;
  userId: string;
}): Promise<Lesson[]> {
  try {
    return await db
      .select()
      .from(lessons)
      .where(
        and(eq(lessons.documentId, documentId), eq(lessons.userId, userId))
      )
      .orderBy(asc(lessons.createdAt))
      .execute();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch lessons");
  }
}

export async function getLessonById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Lesson | null> {
  try {
    const [result] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, id), eq(lessons.userId, userId)))
      .limit(1)
      .execute();

    return result || null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch lesson");
  }
}

export async function createFlashcards({
  lessonId,
  flashcards: flashcardData,
}: {
  lessonId: string;
  flashcards: {
    front: string;
    back: string;
    sourcePage: number;
  }[];
}): Promise<Flashcard[]> {
  try {
    const flashcardsToInsert = flashcardData.map((card) => ({
      lessonId,
      front: card.front,
      back: card.back,
      sourcePage: card.sourcePage,
    }));

    return await db.insert(flashcards).values(flashcardsToInsert).returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create flashcards"
    );
  }
}

export async function getFlashcardsByLessonId({
  lessonId,
}: {
  lessonId: string;
}): Promise<Flashcard[]> {
  try {
    return await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.lessonId, lessonId))
      .orderBy(asc(flashcards.createdAt))
      .execute();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch flashcards"
    );
  }
}

export async function createChatQuiz({
  chatId,
  userId,
  title,
  questions: quizQuestions,
}: {
  chatId: string;
  userId: string;
  title: string;
  questions: any[];
}): Promise<ChatQuiz> {
  try {
    const [result] = await db
      .insert(chatQuizzes)
      .values({
        chatId,
        userId,
        title,
        questions: quizQuestions,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create chat quiz");
    }

    return result;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create chat quiz"
    );
  }
}

export async function getChatQuizById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<ChatQuiz | null> {
  try {
    const [result] = await db
      .select()
      .from(chatQuizzes)
      .where(and(eq(chatQuizzes.id, id), eq(chatQuizzes.userId, userId)))
      .limit(1)
      .execute();

    return result || null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch chat quiz");
  }
}

export async function updateChatQuiz({
  id,
  userId,
  updates,
}: {
  id: string;
  userId: string;
  updates: Partial<
    Pick<ChatQuiz, "currentQuestionIndex" | "answers" | "isCompleted">
  >;
}): Promise<ChatQuiz> {
  try {
    const [result] = await db
      .update(chatQuizzes)
      .set(updates)
      .where(and(eq(chatQuizzes.id, id), eq(chatQuizzes.userId, userId)))
      .returning();

    if (!result) {
      throw new Error("Failed to update chat quiz");
    }

    return result;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat quiz"
    );
  }
}

export async function getDocumentChunks({
  documentId,
}: {
  documentId: string;
}): Promise<DocumentChunk[]> {
  try {
    return await db
      .select()
      .from(docChunks)
      .where(eq(docChunks.documentId, documentId))
      .orderBy(asc(docChunks.page))
      .execute();
  } catch (error) {
    console.warn("Database not configured, returning empty chunks:", error);
    // Return empty array instead of mock data to avoid confusion
    return [];
  }
}
