import { relations } from "drizzle-orm/relations";
import { chat, message, user, messageV2, quizzes, questions, stream, attempts, answers, documents, docChunks, suggestion, document, chatQuizzes, lessons, flashcards, documentSummaries, tutorSessions, vote, voteV2 } from "./schema";

export const messageRelations = relations(message, ({one, many}) => ({
	chat: one(chat, {
		fields: [message.chatId],
		references: [chat.id]
	}),
	votes: many(vote),
}));

export const chatRelations = relations(chat, ({one, many}) => ({
	messages: many(message),
	user: one(user, {
		fields: [chat.userId],
		references: [user.id]
	}),
	messageV2s: many(messageV2),
	streams: many(stream),
	chatQuizzes: many(chatQuizzes),
	tutorSessions: many(tutorSessions),
	votes: many(vote),
	voteV2s: many(voteV2),
}));

export const userRelations = relations(user, ({many}) => ({
	chats: many(chat),
	suggestions: many(suggestion),
	tutorSessions: many(tutorSessions),
	documents: many(document),
}));

export const messageV2Relations = relations(messageV2, ({one, many}) => ({
	chat: one(chat, {
		fields: [messageV2.chatId],
		references: [chat.id]
	}),
	voteV2s: many(voteV2),
}));

export const questionsRelations = relations(questions, ({one, many}) => ({
	quiz: one(quizzes, {
		fields: [questions.quizId],
		references: [quizzes.id]
	}),
	answers: many(answers),
}));

export const quizzesRelations = relations(quizzes, ({many}) => ({
	questions: many(questions),
	attempts: many(attempts),
}));

export const streamRelations = relations(stream, ({one}) => ({
	chat: one(chat, {
		fields: [stream.chatId],
		references: [chat.id]
	}),
}));

export const attemptsRelations = relations(attempts, ({one, many}) => ({
	quiz: one(quizzes, {
		fields: [attempts.quizId],
		references: [quizzes.id]
	}),
	answers: many(answers),
}));

export const answersRelations = relations(answers, ({one}) => ({
	attempt: one(attempts, {
		fields: [answers.attemptId],
		references: [attempts.id]
	}),
	question: one(questions, {
		fields: [answers.questionId],
		references: [questions.id]
	}),
}));

export const docChunksRelations = relations(docChunks, ({one}) => ({
	document: one(documents, {
		fields: [docChunks.documentId],
		references: [documents.id]
	}),
}));

export const documentsRelations = relations(documents, ({many}) => ({
	docChunks: many(docChunks),
	lessons: many(lessons),
	documentSummaries: many(documentSummaries),
}));

export const suggestionRelations = relations(suggestion, ({one}) => ({
	user: one(user, {
		fields: [suggestion.userId],
		references: [user.id]
	}),
	document: one(document, {
		fields: [suggestion.documentId],
		references: [document.id]
	}),
}));

export const documentRelations = relations(document, ({one, many}) => ({
	suggestions: many(suggestion),
	user: one(user, {
		fields: [document.userId],
		references: [user.id]
	}),
}));

export const chatQuizzesRelations = relations(chatQuizzes, ({one}) => ({
	chat: one(chat, {
		fields: [chatQuizzes.chatId],
		references: [chat.id]
	}),
}));

export const lessonsRelations = relations(lessons, ({one, many}) => ({
	document: one(documents, {
		fields: [lessons.documentId],
		references: [documents.id]
	}),
	flashcards: many(flashcards),
}));

export const flashcardsRelations = relations(flashcards, ({one}) => ({
	lesson: one(lessons, {
		fields: [flashcards.lessonId],
		references: [lessons.id]
	}),
}));

export const documentSummariesRelations = relations(documentSummaries, ({one}) => ({
	document: one(documents, {
		fields: [documentSummaries.documentId],
		references: [documents.id]
	}),
}));

export const tutorSessionsRelations = relations(tutorSessions, ({one}) => ({
	chat: one(chat, {
		fields: [tutorSessions.chatId],
		references: [chat.id]
	}),
	user: one(user, {
		fields: [tutorSessions.userId],
		references: [user.id]
	}),
}));

export const voteRelations = relations(vote, ({one}) => ({
	chat: one(chat, {
		fields: [vote.chatId],
		references: [chat.id]
	}),
	message: one(message, {
		fields: [vote.messageId],
		references: [message.id]
	}),
}));

export const voteV2Relations = relations(voteV2, ({one}) => ({
	chat: one(chat, {
		fields: [voteV2.chatId],
		references: [chat.id]
	}),
	messageV2: one(messageV2, {
		fields: [voteV2.messageId],
		references: [messageV2.id]
	}),
}));