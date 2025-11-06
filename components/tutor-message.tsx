"use client";

import { motion } from "framer-motion";
import { BookOpen, FileText, GraduationCap, MessageSquare } from "lucide-react";
import type { TutorSessionState } from "@/app/actions/tutor-session";
import { Response } from "@/components/elements/response";
import { TutorCommands } from "@/components/tutor-commands";
import { TutorSessionIndicator } from "@/components/tutor-session-indicator";
import { useTutorSession } from "@/hooks/use-tutor-session";

type TutorMessageProps = {
  chatId: string;
  messageId: string;
  content: string;
  metadata?: {
    type:
      | "tutor_explanation"
      | "tutor_quiz"
      | "tutor_command_response"
      | "tutor_resume";
    topicId?: string;
    subtopicId?: string;
    pages?: number[];
    sessionStep?: string;
    sessionState?: TutorSessionState;
  };
  onSessionUpdate?: (sessionState: TutorSessionState) => void;
};

export function TutorMessage({
  chatId,
  content,
  metadata,
  onSessionUpdate,
}: TutorMessageProps) {
  const { sessionState, updateStep } = useTutorSession(chatId);

  // Update session state if provided in metadata
  if (metadata?.sessionState && onSessionUpdate) {
    onSessionUpdate(metadata.sessionState);
  }

  const getMessageIcon = () => {
    switch (metadata?.type) {
      case "tutor_explanation":
        return <BookOpen className="h-5 w-5 text-blue-600" />;
      case "tutor_quiz":
        return <GraduationCap className="h-5 w-5 text-purple-600" />;
      case "tutor_command_response":
        return <MessageSquare className="h-5 w-5 text-green-600" />;
      case "tutor_resume":
        return <GraduationCap className="h-5 w-5 text-purple-600" />;
      default:
        return <BookOpen className="h-5 w-5 text-blue-600" />;
    }
  };

  const getMessageTitle = () => {
    switch (metadata?.type) {
      case "tutor_explanation":
        return "Learning Session";
      case "tutor_quiz":
        return "Quiz Time";
      case "tutor_command_response":
        return "Tutor Response";
      case "tutor_resume":
        return "Welcome Back";
      default:
        return "Tutor Message";
    }
  };

  const getMessageStyle = () => {
    switch (metadata?.type) {
      case "tutor_explanation":
        return "border-blue-200 bg-blue-50/50";
      case "tutor_quiz":
        return "border-purple-200 bg-purple-50/50";
      case "tutor_command_response":
        return "border-green-200 bg-green-50/50";
      case "tutor_resume":
        return "border-purple-200 bg-purple-50/50";
      default:
        return "border-blue-200 bg-blue-50/50";
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      {/* Session Indicator */}
      {sessionState && (
        <div className="mb-4">
          <TutorSessionIndicator
            onStop={() => {
              // Handle session stop
              updateStep("completed");
            }}
            sessionState={sessionState}
          />
        </div>
      )}

      {/* Tutor Message */}
      <div className={`rounded-lg border p-4 ${getMessageStyle()}`}>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
            {getMessageIcon()}
          </div>

          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-semibold text-base">{getMessageTitle()}</h3>
              {metadata?.topicId && (
                <span className="rounded-full bg-white px-2 py-1 text-muted-foreground text-xs">
                  {metadata.topicId}
                  {metadata.subtopicId && ` → ${metadata.subtopicId}`}
                </span>
              )}
            </div>

            <div className="prose prose-sm max-w-none">
              <Response isStreaming={false} speed={20}>
                {content}
              </Response>
            </div>

            {metadata?.pages && metadata.pages.length > 0 && (
              <div className="mt-3 text-muted-foreground text-sm">
                <FileText className="mr-1 h-4 w-4" /> Pages:{" "}
                {metadata.pages.join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tutor Commands */}
      {sessionState &&
        sessionState.step !== "completed" &&
        metadata?.topicId && (
          <div className="mt-4">
            <TutorCommands
              chatId={chatId}
              onCommandExecuted={() => {
                // Refresh messages after command execution
                window.dispatchEvent(
                  new CustomEvent("refresh-messages", { detail: { chatId } })
                );
              }}
              subtopicId={metadata.subtopicId}
              topicId={metadata.topicId}
            />
          </div>
        )}
    </motion.div>
  );
}
