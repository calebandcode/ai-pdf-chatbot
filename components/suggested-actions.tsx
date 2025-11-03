"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { BookOpen, Brain } from "lucide-react";
import { memo } from "react";
import { usePDFActions } from "@/hooks/use-pdf-actions";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  documentId?: string;
};

function PureSuggestedActions({
  chatId,
  sendMessage,
  documentId,
}: SuggestedActionsProps) {
  const { handlePDFAction } = usePDFActions();

  const pdfActions = documentId
    ? [
        {
          id: "generate-quiz",
          label: "Generate Practice Quiz",
          icon: <BookOpen className="mr-2 h-4 w-4" />,
          onClick: () => {
            handlePDFAction("generate_quiz", documentId, chatId);
          },
        },
        {
          id: "generate-flashcards",
          label: "Generate Flashcards",
          icon: <Brain className="mr-2 h-4 w-4" />,
          onClick: () => {
            handlePDFAction("flashcards", documentId, chatId);
          },
        },
      ]
    : [];

  // Debug: log documentId to see if it's being passed
  if (typeof window !== "undefined") {
    console.log("SuggestedActions - documentId:", documentId);
    console.log("SuggestedActions - pdfActions length:", pdfActions.length);
  }

  if (pdfActions.length === 0) {
    return null;
  }

  return (
    <div
      className="grid w-full gap-2 bg-transparent sm:grid-cols-2"
      data-testid="suggested-actions"
    >
      {pdfActions.map((action, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={action.id}
          transition={{ delay: 0.05 * index }}
        >
          <Suggestion
            className="h-auto w-full whitespace-normal rounded-md border border-gray-200 bg-white p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
            onClick={() => action.onClick()}
            suggestion={action.label}
          >
            <div className="flex items-center">
              {action.icon}
              {action.label}
            </div>
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.documentId !== nextProps.documentId) {
      return false;
    }

    return true;
  }
);
