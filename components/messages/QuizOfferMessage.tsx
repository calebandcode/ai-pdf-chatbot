"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { QuizOfferPayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuizOfferMessageProps = QuizOfferPayload;

const CARD_STYLES: Record<
  keyof QuizOfferPayload,
  { title: string; description: string; accent: string }
> = {
  easy: {
    title: "Easy Warm-up",
    description: "Quick checkpoints to confirm you understood the highlights.",
    accent: "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/5 dark:text-emerald-100",
  },
  hard: {
    title: "Hard Challenge",
    description: "Deeper reasoning prompts to stress-test your understanding.",
    accent: "border-indigo-200/80 bg-indigo-50 text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/5 dark:text-indigo-100",
  },
};

export function QuizOfferMessage({ easy, hard }: QuizOfferMessageProps) {
  const handleStart = useCallback((difficulty: "easy" | "hard") => {
    toast.info(`Quiz launch for ${difficulty} mode coming soon.`);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Quiz Ready
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["easy", easy] as const,
            ["hard", hard] as const,
          ] satisfies Array<["easy" | "hard", typeof easy]>
        ).map(([difficulty, payload]) => {
          const card = CARD_STYLES[difficulty];

          return (
            <div
              key={difficulty}
              className={cn(
                "flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md",
                card.accent
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">{card.title}</h3>
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
                onClick={() => handleStart(difficulty)}
                size="sm"
                variant="secondary"
              >
                Start
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
