import { pgTable, foreignKey, uuid, varchar, json, timestamp, text, jsonb, integer, boolean, uniqueIndex, vector, primaryKey } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"




export const message = pgTable("Message", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid().notNull(),
	role: varchar().notNull(),
	content: json().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		messageChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Message_chatId_Chat_id_fk"
		}),
	}
});

export const chat = pgTable("Chat", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	title: text().notNull(),
	userId: uuid().notNull(),
	visibility: varchar().default('private').notNull(),
	lastContext: jsonb(),
},
(table) => {
	return {
		chatUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Chat_userId_User_id_fk"
		}),
	}
});

export const messageV2 = pgTable("Message_v2", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid().notNull(),
	role: varchar().notNull(),
	parts: json().notNull(),
	attachments: json().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		messageV2ChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Message_v2_chatId_Chat_id_fk"
		}),
	}
});

export const quizzes = pgTable("quizzes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text().notNull(),
	topic: text(),
	difficulty: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const questions = pgTable("questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quizId: uuid("quiz_id").notNull(),
	prompt: text().notNull(),
	difficulty: text().notNull(),
	options: jsonb().notNull(),
	correct: text().notNull(),
	explanation: text().notNull(),
	rationales: jsonb().notNull(),
	sourceRefs: jsonb("source_refs").notNull(),
},
(table) => {
	return {
		questionsQuizIdQuizzesIdFk: foreignKey({
			columns: [table.quizId],
			foreignColumns: [quizzes.id],
			name: "questions_quiz_id_quizzes_id_fk"
		}).onDelete("cascade"),
	}
});

export const stream = pgTable("Stream", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		streamChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Stream_chatId_Chat_id_fk"
		}),
	}
});

export const attempts = pgTable("attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quizId: uuid("quiz_id").notNull(),
	userId: text("user_id").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	scorePct: integer("score_pct"),
},
(table) => {
	return {
		attemptsQuizIdQuizzesIdFk: foreignKey({
			columns: [table.quizId],
			foreignColumns: [quizzes.id],
			name: "attempts_quiz_id_quizzes_id_fk"
		}).onDelete("cascade"),
	}
});

export const answers = pgTable("answers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	attemptId: uuid("attempt_id").notNull(),
	questionId: uuid("question_id").notNull(),
	chosenOptionId: text("chosen_option_id"),
	isCorrect: boolean("is_correct"),
	feedback: text(),
},
(table) => {
	return {
		answersAttemptIdAttemptsIdFk: foreignKey({
			columns: [table.attemptId],
			foreignColumns: [attempts.id],
			name: "answers_attempt_id_attempts_id_fk"
		}).onDelete("cascade"),
		answersQuestionIdQuestionsIdFk: foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "answers_question_id_questions_id_fk"
		}).onDelete("cascade"),
	}
});

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text().notNull(),
	blobUrl: text("blob_url").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const docChunks = pgTable("doc_chunks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	page: integer().notNull(),
	content: text().notNull(),
	embedding: vector({ dimensions: 1536 }),
	tokens: integer(),
},
(table) => {
	return {
		uniqDocPageContent: uniqueIndex("uniq_doc_page_content").using("btree", table.documentId.asc().nullsLast(), table.page.asc().nullsLast(), table.content.asc().nullsLast()),
		docChunksDocumentIdDocumentsIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "doc_chunks_document_id_documents_id_fk"
		}).onDelete("cascade"),
	}
});

export const user = pgTable("User", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 64 }).notNull(),
	password: varchar({ length: 64 }),
});

export const suggestion = pgTable("Suggestion", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid().notNull(),
	documentCreatedAt: timestamp({ mode: 'string' }).notNull(),
	originalText: text().notNull(),
	suggestedText: text().notNull(),
	description: text(),
	isResolved: boolean().default(false).notNull(),
	userId: uuid().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
},
(table) => {
	return {
		suggestionUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Suggestion_userId_User_id_fk"
		}),
		suggestionDocumentIdDocumentCreatedAtDocumentIdCreatedAtF: foreignKey({
			columns: [table.documentId, table.documentCreatedAt],
			foreignColumns: [document.id, document.createdAt],
			name: "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_f"
		}),
	}
});

export const chatQuizzes = pgTable("chat_quizzes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid("chat_id").notNull(),
	userId: text("user_id").notNull(),
	title: text().notNull(),
	questions: jsonb().notNull(),
	currentQuestionIndex: integer("current_question_index").default(0).notNull(),
	answers: jsonb().default({}).notNull(),
	isCompleted: boolean("is_completed").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		chatQuizzesChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "chat_quizzes_chat_id_Chat_id_fk"
		}).onDelete("cascade"),
	}
});

export const lessons = pgTable("lessons", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	userId: text("user_id").notNull(),
	title: text().notNull(),
	summary: text().notNull(),
	keyTerms: jsonb("key_terms").notNull(),
	sourcePages: jsonb("source_pages").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		lessonsDocumentIdDocumentsIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "lessons_document_id_documents_id_fk"
		}).onDelete("cascade"),
	}
});

export const flashcards = pgTable("flashcards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	lessonId: uuid("lesson_id").notNull(),
	front: text().notNull(),
	back: text().notNull(),
	sourcePage: integer("source_page").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		flashcardsLessonIdLessonsIdFk: foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lessons.id],
			name: "flashcards_lesson_id_lessons_id_fk"
		}).onDelete("cascade"),
	}
});

export const documentSummaries = pgTable("document_summaries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	summary: text().notNull(),
	suggestedActions: jsonb("suggested_actions").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	mainTopics: jsonb("main_topics"),
},
(table) => {
	return {
		documentSummariesDocumentIdDocumentsIdFk: foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_summaries_document_id_documents_id_fk"
		}).onDelete("cascade"),
	}
});

export const tutorSessions = pgTable("tutor_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid("chat_id").notNull(),
	userId: uuid("user_id").notNull(),
	state: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		tutorSessionsChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "tutor_sessions_chat_id_Chat_id_fk"
		}).onDelete("cascade"),
		tutorSessionsUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "tutor_sessions_user_id_User_id_fk"
		}).onDelete("cascade"),
	}
});

export const vote = pgTable("Vote", {
	chatId: uuid().notNull(),
	messageId: uuid().notNull(),
	isUpvoted: boolean().notNull(),
},
(table) => {
	return {
		voteChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Vote_chatId_Chat_id_fk"
		}),
		voteMessageIdMessageIdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [message.id],
			name: "Vote_messageId_Message_id_fk"
		}),
		voteChatIdMessageIdPk: primaryKey({ columns: [table.chatId, table.messageId], name: "Vote_chatId_messageId_pk"}),
	}
});

export const voteV2 = pgTable("Vote_v2", {
	chatId: uuid().notNull(),
	messageId: uuid().notNull(),
	isUpvoted: boolean().notNull(),
},
(table) => {
	return {
		voteV2ChatIdChatIdFk: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "Vote_v2_chatId_Chat_id_fk"
		}),
		voteV2MessageIdMessageV2IdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [messageV2.id],
			name: "Vote_v2_messageId_Message_v2_id_fk"
		}),
		voteV2ChatIdMessageIdPk: primaryKey({ columns: [table.chatId, table.messageId], name: "Vote_v2_chatId_messageId_pk"}),
	}
});

export const document = pgTable("Document", {
	id: uuid().defaultRandom().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	title: text().notNull(),
	content: text(),
	text: varchar().default('text').notNull(),
	metadata: jsonb().default(null),
	userId: uuid().notNull(),
},
(table) => {
	return {
		documentUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Document_userId_User_id_fk"
		}),
		documentIdCreatedAtPk: primaryKey({ columns: [table.id, table.createdAt], name: "Document_id_createdAt_pk"}),
	}
});