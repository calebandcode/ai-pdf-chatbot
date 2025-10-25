import type { Question } from "@/lib/db/schema";
import type { QuizQuestion } from "@/lib/types";

function normalizeOptions(options: unknown, questionId: string) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option, index) => {
    if (typeof option === "object" && option !== null) {
      const optionObject = option as Record<string, unknown>;
      const id =
        typeof optionObject.id === "string"
          ? optionObject.id
          : `${questionId}-option-${index}`;
      const label =
        typeof optionObject.label === "string"
          ? optionObject.label
          : String.fromCharCode(65 + index);
      const text =
        typeof optionObject.text === "string"
          ? optionObject.text
          : typeof optionObject.description === "string"
            ? optionObject.description
            : "";

      return {
        id,
        label,
        text,
      };
    }

    return {
      id: `${questionId}-option-${index}`,
      label: String.fromCharCode(65 + index),
      text: typeof option === "string" ? option : "",
    };
  });
}

function normalizeSourceRefs(sourceRefs: unknown) {
  if (!Array.isArray(sourceRefs)) {
    return [];
  }

  return sourceRefs
    .map((ref) => {
      if (typeof ref === "object" && ref !== null) {
        const refObject = ref as Record<string, unknown>;
        const documentId =
          typeof refObject.documentId === "string"
            ? refObject.documentId
            : undefined;
        const page =
          typeof refObject.page === "number" ? refObject.page : undefined;

        if (documentId && typeof page === "number") {
          return { documentId, page };
        }
      }

      return null;
    })
    .filter(
      (ref): ref is { documentId: string; page: number } => ref !== null
    );
}

export function toQuizQuestions(questions: Question[]): QuizQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    difficulty:
      question.difficulty === "hard"
        ? "hard"
        : ("easy" as QuizQuestion["difficulty"]),
    options: normalizeOptions(question.options, question.id),
    correct: question.correct ?? "",
    explanation: question.explanation ?? "",
    sourceRefs: normalizeSourceRefs(question.sourceRefs),
  }));
}
