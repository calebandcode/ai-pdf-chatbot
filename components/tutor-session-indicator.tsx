"use client";

import { BookOpen, CheckCircle, Clock, GraduationCap } from "lucide-react";
import type { TutorSessionState } from "@/app/actions/tutor-session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type TutorSessionIndicatorProps = {
  sessionState: TutorSessionState;
  onStop?: () => void;
};

export function TutorSessionIndicator({
  sessionState,
  onStop,
}: TutorSessionIndicatorProps) {
  const getStepIcon = (step: TutorSessionState["step"]) => {
    switch (step) {
      case "explain":
        return <BookOpen className="h-4 w-4" />;
      case "quiz":
        return <GraduationCap className="h-4 w-4" />;
      case "remediate":
        return <BookOpen className="h-4 w-4" />;
      case "advance":
        return <CheckCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStepLabel = (step: TutorSessionState["step"]) => {
    switch (step) {
      case "explain":
        return "Learning";
      case "quiz":
        return "Quiz Time";
      case "remediate":
        return "Review";
      case "advance":
        return "Advancing";
      case "completed":
        return "Completed";
      default:
        return "Unknown";
    }
  };

  const getStepColor = (step: TutorSessionState["step"]) => {
    switch (step) {
      case "explain":
        return "bg-blue-100 text-blue-800";
      case "quiz":
        return "bg-purple-100 text-purple-800";
      case "remediate":
        return "bg-yellow-100 text-yellow-800";
      case "advance":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const accuracy =
    sessionState.progress.totalAsked > 0
      ? Math.round(
          (sessionState.progress.totalCorrect /
            sessionState.progress.totalAsked) *
            100
        )
      : 0;

  return (
    <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getStepIcon(sessionState.step)}
              <span className="font-medium text-purple-800">
                Guided Learning Session
              </span>
            </div>

            <Badge className={getStepColor(sessionState.step)}>
              {getStepLabel(sessionState.step)}
            </Badge>
          </div>

          {onStop && sessionState.step !== "completed" && (
            <button
              className="font-medium text-red-600 text-sm hover:text-red-800"
              onClick={onStop}
              type="button"
            >
              End Session
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Topic:</span>
            <span className="ml-2 font-medium">{sessionState.topicId}</span>
            {sessionState.subtopicId && (
              <span className="ml-1 text-muted-foreground">
                → {sessionState.subtopicId}
              </span>
            )}
          </div>

          <div>
            <span className="text-muted-foreground">Progress:</span>
            <span className="ml-2 font-medium">
              {sessionState.progress.totalCorrect}/
              {sessionState.progress.totalAsked}({accuracy}%)
            </span>
          </div>
        </div>

        {sessionState.currentPages.length > 0 && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Pages:</span>
            <span className="ml-2 font-medium">
              {sessionState.currentPages.join(", ")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
