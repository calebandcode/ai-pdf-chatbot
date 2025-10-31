"use client";

import { BookOpen, Clock, Lightbulb, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SessionProgressProps = {
  questionsAnswered: number;
  totalQuestions: number;
  correctAnswers: number;
  startTime: Date;
};

export function SessionProgress({
  questionsAnswered,
  totalQuestions,
  correctAnswers,
  startTime,
}: SessionProgressProps) {
  const [sessionDuration, setSessionDuration] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setSessionDuration(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const accuracy =
    questionsAnswered > 0
      ? Math.round((correctAnswers / questionsAnswered) * 100)
      : 0;

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-semibold text-lg">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Study Session Progress
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BookOpen className="h-4 w-4" />
              <span>Questions</span>
            </div>
            <div className="mt-1 font-semibold text-lg">
              {questionsAnswered} / {totalQuestions}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>Time</span>
            </div>
            <div className="mt-1 font-semibold text-lg">
              {formatDuration(sessionDuration)}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-green-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                className="border-green-200 bg-green-100 text-green-800"
                variant="outline"
              >
                Accuracy
              </Badge>
              <span className="font-semibold text-green-800">{accuracy}%</span>
            </div>
            <div className="text-green-700 text-sm">
              {correctAnswers} correct out of {questionsAnswered}
            </div>
          </div>
        </div>

        {questionsAnswered > 0 && (
          <div className="rounded-lg border bg-blue-50 p-3">
            <p className="text-blue-800 text-sm">
              <Lightbulb className="mr-1 h-4 w-4 text-yellow-500" />{" "}
              <strong>Great job!</strong> You're actively learning and improving
              your understanding. Keep up the excellent work!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
