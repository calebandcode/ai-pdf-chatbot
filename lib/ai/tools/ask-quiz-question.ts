import { z } from "zod";

export const askQuizQuestion = {
  description: "Ask a quiz question and wait for user response",
  inputSchema: z.object({
    question: z.string().describe("The quiz question text"),
    options: z.record(z.string()).describe("Answer options (A, B, C, D)"),
    questionNumber: z.number().describe("Current question number"),
    totalQuestions: z.number().describe("Total number of questions in quiz"),
    quizId: z.string().describe("Unique quiz identifier"),
    difficulty: z.string().describe("Question difficulty level"),
    sourcePage: z
      .number()
      .describe("Page number where question content appears"),
  }),
  onInputAvailable: async (options: { input: any }) => {
    // This tool call will be handled by the UI component
    // The actual quiz question will be rendered in the message component
    return;
  },
};
