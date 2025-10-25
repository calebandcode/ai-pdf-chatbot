"use client";

import { type FC, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Artifact, type ArtifactContent } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { Button } from "@/components/ui/button";
import { QUIZ_DEFAULT_DURATION_SECONDS } from "@/lib/quiz/constants";
import type { QuizQuestion, QuizResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type QuizArtifactMetadata = {
  quizId: string | null;
  title: string;
  questions: QuizQuestion[];
  answers: Record<string, string | null>;
  activeQuestionIndex: number;
  startedAt: number | null;
  durationSeconds: number;
  submitted: boolean;
  result: QuizResult | null;
};

const INITIAL_METADATA: QuizArtifactMetadata = {
  quizId: null,
  title: "",
  questions: [],
  answers: {},
  activeQuestionIndex: 0,
  startedAt: null,
  durationSeconds: QUIZ_DEFAULT_DURATION_SECONDS,
  submitted: false,
  result: null,
};

const formatTime = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const secs = (clamped % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
};

const QuizArtifactContent: FC<ArtifactContent<QuizArtifactMetadata>> = ({
  metadata = INITIAL_METADATA,
  setMetadata,
  isLoading,
  status,
}) => {
  const [frameTime, setFrameTime] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!metadata || !metadata.quizId || metadata.submitted) {
      return;
    }

    if (!metadata.startedAt) {
      setMetadata((current) => ({
        ...current,
        startedAt: Date.now(),
      }));
    }

    const interval = setInterval(() => {
      setFrameTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [metadata, setMetadata]);

  useEffect(() => {
    if (!metadata || !metadata.quizId) {
      return;
    }

    const missingAnswers = metadata.questions.some(
      (question) => !(question.id in metadata.answers)
    );

    if (missingAnswers) {
      setMetadata((current) => ({
        ...current,
        answers: Object.fromEntries(
          current.questions.map((question) => [
            question.id,
            current.answers?.[question.id] ?? null,
          ])
        ),
      }));
    }
  }, [metadata, setMetadata]);

  const remainingSeconds = useMemo(() => {
    if (!metadata || !metadata.startedAt || metadata.submitted) {
      return metadata?.durationSeconds || 300;
    }

    const elapsed = Math.floor((frameTime - metadata.startedAt) / 1000);
    return Math.max(metadata.durationSeconds - elapsed, 0);
  }, [frameTime, metadata]);

  const formattedTime = formatTime(remainingSeconds);

  if (isLoading && status === "streaming") {
    return <DocumentSkeleton artifactKind="quiz" />;
  }

  if (!metadata || !metadata.quizId || metadata.questions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <p className="font-medium">Choose a quiz to get started.</p>
        <p className="max-w-sm text-sm">
          Drop a document and select a difficulty to automatically generate a
          practice test.
        </p>
      </div>
    );
  }

  const activeQuestion =
    metadata?.questions[metadata.activeQuestionIndex] ?? metadata?.questions[0];
  const selectedOption = metadata?.answers[activeQuestion?.id] ?? null;

  const handleSelectOption = (optionId: string) => {
    if (!metadata || metadata.submitted) {
      return;
    }

    setMetadata((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [activeQuestion.id]: optionId,
      },
    }));
  };

  const handleNavigate = (index: number) => {
    setMetadata((current) => ({
      ...current,
      activeQuestionIndex: index,
    }));
  };

  const computeLocalResult = (): QuizResult => {
    if (!metadata) {
      return {
        quizId: "",
        total: 0,
        correctCount: 0,
        score: 0,
        answers: [],
      };
    }

    const evaluatedAnswers = metadata.questions.map((question) => {
      const chosen = metadata.answers[question.id] ?? null;
      return {
        questionId: question.id,
        chosenOptionId: chosen,
        isCorrect: chosen === question.correct,
      };
    });

    const total = evaluatedAnswers.length;
    const correctCount = evaluatedAnswers.filter(
      (entry) => entry.isCorrect
    ).length;

    return {
      quizId: metadata.quizId ?? "",
      total,
      correctCount,
      score: total === 0 ? 0 : Math.round((correctCount / total) * 100),
      answers: evaluatedAnswers,
    };
  };

  const handleSubmit = async () => {
    if (!metadata || metadata.submitted || isSubmitting || !metadata.quizId) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Use local scoring for self-contained quiz artifacts
      const result = computeLocalResult();

      setMetadata((current) => ({
        ...current,
        submitted: true,
        result,
      }));

      toast.success("Quiz completed! Review your results below.");
    } catch (error) {
      console.error("Error computing quiz result:", error);
      toast.error("Failed to compute quiz results. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setMetadata((current) => ({
      ...INITIAL_METADATA,
      quizId: current.quizId,
      title: current.title,
      questions: current.questions,
      answers: Object.fromEntries(
        current.questions.map((question) => [question.id, null])
      ),
      startedAt: Date.now(),
    }));
  };

  const result = metadata?.result;
  const answeredCount = metadata
    ? Object.values(metadata.answers).filter((value) => value !== null).length
    : 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <header className="flex flex-col gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">
              {metadata?.title || "Quiz"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {metadata?.questions.length || 0} questions •{" "}
              {Math.max(QUIZ_DEFAULT_DURATION_SECONDS / 60, 1)} minute timer
            </p>
          </div>
          <div
            className={cn(
              "rounded-full px-3 py-1 font-semibold text-sm",
              remainingSeconds > 60
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : remainingSeconds > 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"
            )}
          >
            {metadata?.submitted ? "Completed" : `Time left: ${formattedTime}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          <span>
            Answered {answeredCount} / {metadata?.questions.length || 0}
          </span>
          {!metadata?.submitted && remainingSeconds <= 0 && (
            <span className="font-medium text-red-500 dark:text-red-400">
              Time is up! Review and submit when you are ready.
            </span>
          )}
        </div>
      </header>

      {result ? (
        <div className="rounded-xl border bg-muted/20 p-4">
          <h3 className="font-semibold text-base">Results</h3>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Score</span>
              <div className="font-semibold text-lg">{result.score}%</div>
            </div>
            <div>
              <span className="text-muted-foreground">Correct</span>
              <div className="font-semibold">
                {result.correctCount} / {result.total}
              </div>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleRetake}
            size="sm"
            variant="secondary"
          >
            Retake Quiz
          </Button>
        </div>
      ) : null}

      <div className="grid flex-1 gap-4 lg:grid-cols-[240px,1fr]">
        <aside className="flex flex-col gap-2 rounded-xl border bg-muted/10 p-3">
          <div className="font-medium text-muted-foreground text-sm uppercase">
            Questions
          </div>
          <div className="grid grid-cols-6 gap-2">
            {metadata?.questions.map((question, index) => {
              const isActive = index === metadata.activeQuestionIndex;
              const answered = metadata.answers[question.id] !== null;

              return (
                <button
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg border font-medium text-sm transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : answered
                        ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-muted bg-background text-muted-foreground hover:border-muted-foreground/40"
                  )}
                  key={question.id}
                  onClick={() => handleNavigate(index)}
                  type="button"
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex h-full flex-col rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-muted-foreground text-xs uppercase">
              Question {metadata?.activeQuestionIndex + 1 || 1} of{" "}
              {metadata?.questions.length || 0}
            </div>
            <div className="text-muted-foreground text-xs">
              Difficulty:{" "}
              <span className="font-semibold capitalize">
                {activeQuestion?.difficulty || "easy"}
              </span>
            </div>
          </div>
          <h3 className="mt-3 font-medium text-base leading-relaxed">
            {activeQuestion?.prompt || "Question not available"}
          </h3>

          <div className="mt-4 grid gap-2">
            {activeQuestion?.options.map((option) => {
              const isSelected = selectedOption === option.id;
              const isCorrect =
                metadata?.submitted && option.id === activeQuestion.correct;
              const isIncorrect =
                metadata?.submitted &&
                isSelected &&
                option.id !== activeQuestion.correct;

              return (
                <button
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    isSelected && !metadata.submitted
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:border-primary/40",
                    isCorrect && "border-emerald-500 bg-emerald-500/10",
                    isIncorrect && "border-red-500 bg-red-500/10"
                  )}
                  disabled={metadata?.submitted || isSubmitting}
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  type="button"
                >
                  <span className="mt-0.5 font-semibold text-sm">
                    {option.label}
                  </span>
                  <span className="text-sm leading-relaxed">{option.text}</span>
                </button>
              );
            })}
          </div>

          {!metadata?.submitted && (
            <div className="mt-auto flex justify-end pt-4">
              <Button
                disabled={isSubmitting}
                onClick={handleSubmit}
                type="button"
              >
                {isSubmitting ? "Submitting..." : "Submit Quiz"}
              </Button>
            </div>
          )}

          {metadata?.submitted ? (
            <div className="mt-4 rounded-lg border border-dashed bg-muted/20 p-3 text-muted-foreground text-sm">
              <p className="font-semibold text-foreground">Review</p>
              <p className="mt-1 leading-relaxed">
                Correct answers are highlighted in green. Any incorrect choices
                are marked in red so you can quickly identify what to revisit.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export const quizArtifact = new Artifact<"quiz", QuizArtifactMetadata>({
  kind: "quiz",
  description: "Review quiz questions generated from your documents.",
  initialize: ({ setMetadata }) => {
    setMetadata((current) => current ?? { ...INITIAL_METADATA });
  },
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === "data-quizInitial") {
      const { quizId, title, questions } = streamPart.data;

      setMetadata({
        quizId,
        title,
        questions,
        answers: Object.fromEntries(
          questions.map((question) => [question.id, null])
        ),
        activeQuestionIndex: 0,
        startedAt: Date.now(),
        durationSeconds: QUIZ_DEFAULT_DURATION_SECONDS,
        submitted: false,
        result: null,
      });

      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: "",
        isVisible: true,
        status: "idle",
      }));
    }

    if (streamPart.type === "data-quizResult") {
      setMetadata((current) => ({
        ...(current ?? INITIAL_METADATA),
        submitted: true,
        result: streamPart.data,
      }));
    }

    if (streamPart.type === "data-clear") {
      setMetadata({ ...INITIAL_METADATA });
    }
  },
  content: QuizArtifactContent,
  actions: [],
  toolbar: [],
});
