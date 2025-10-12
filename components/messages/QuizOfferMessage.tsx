"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { openQuiz } from "@/app/actions/open-quiz";
import type { QuizDifficulty, QuizOfferPayload } from "@/lib/types";
import { useArtifact } from "@/hooks/use-artifact";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QUIZ_DEFAULT_DURATION_SECONDS } from "@/lib/quiz/constants";

const CARD_STYLES: Record<
  keyof QuizOfferPayload,
  { title: string; description: string; accent: string }
> = {
  easy: {
    title: "Easy Warm-up",
    description: "Quick checkpoints to confirm you understood the highlights.",
    accent:
      "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/5 dark:text-emerald-100",
  },
  hard: {
    title: "Hard Challenge",
    description: "Deeper reasoning prompts to stress-test your understanding.",
    accent:
      "border-indigo-200/80 bg-indigo-50 text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/5 dark:text-indigo-100",
  },
};

type QuizOfferMessageProps = QuizOfferPayload;

export function QuizOfferMessage({ easy, hard }: QuizOfferMessageProps) {
  const { setArtifact, setMetadata } = useArtifact();
  const [pendingDifficulty, setPendingDifficulty] =
    useState<QuizDifficulty | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStart = useCallback(
    (difficulty: QuizDifficulty) =>
      (event: React.MouseEvent<HTMLButtonElement>) => {
        const summary = difficulty === "easy" ? easy : hard;

        if (!summary) {
          toast.error("Quiz information is unavailable. Try regenerating.");
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        setPendingDifficulty(difficulty);

        startTransition(async () => {
          try {
            const result = await openQuiz({
              quizId: summary.quizId,
              title: summary.title,
            });

            const metadata = {
              quizId: result.quiz.quizId,
              title: result.quiz.title,
              questions: result.quiz.questions,
              answers: Object.fromEntries(
                result.quiz.questions.map((question) => [question.id, null])
              ),
              activeQuestionIndex: 0,
              startedAt: Date.now(),
              durationSeconds: QUIZ_DEFAULT_DURATION_SECONDS,
              submitted: false,
              result: null,
            };

            setArtifact({
              documentId: result.documentId,
              kind: "quiz",
              content: "",
              title: result.title,
              isVisible: true,
              status: "idle",
              boundingBox: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              },
            });

            setTimeout(() => {
              setMetadata(metadata);
            }, 0);
          } catch (error) {
            console.error("Failed to open quiz artifact", error);
            toast.error(
              "We couldn't open the quiz right now. Please try again in a few seconds."
            );
          } finally {
            setPendingDifficulty(null);
          }
        });
      },
    [easy, hard, setArtifact, setMetadata, startTransition]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Quiz Ready
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([['easy', easy], ['hard', hard]] as const).map(([difficulty, payload]) => {
          const card = CARD_STYLES[difficulty];
          const isLoading = isPending && pendingDifficulty === difficulty;

          return (
            <div
              key={difficulty}
              className={cn(
                "flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md",
                card.accent
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base">{card.title}</h3>
                    <p className="text-xs font-medium opacity-70">
                      {payload.title ?? card.title}
                    </p>
                  </div>
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold shadow-sm">
                    {payload.count} questions
                  </span>
                </div>
                <p className="text-sm leading-snug opacity-80">
                  {card.description}
                </p>
              </div>
              <Button
                className="mt-4 self-start"
                disabled={isLoading}
                onClick={handleStart(difficulty)}
                size="sm"
                variant="secondary"
              >
                {isLoading ? "Opening..." : "Start"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


