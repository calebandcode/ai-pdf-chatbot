"use client";
import { toast } from "sonner";
import { startChatQuiz } from "@/app/actions/chat-quiz";
import { generateLessonFromDocument } from "@/app/actions/generate-lesson";
import type { PDFSuggestionAction } from "@/components/pdf-suggestions";

export function usePDFActions() {
  const handlePDFAction = async (
    type: PDFSuggestionAction["type"],
    documentId: string,
    chatId: string
  ) => {
    try {
      switch (type) {
        case "quiz_drill":
          // Start an interactive chat quiz
          await startChatQuiz({
            chatId,
            documentIds: [documentId],
            title: "Interactive Quiz Drill",
          });
          toast.success("Starting quiz drill! Check the chat for questions.");

          // Refresh messages to show the quiz question
          window.dispatchEvent(
            new CustomEvent("refresh-messages", { detail: { chatId } })
          );
          break;

        case "generate_quiz":
          // Open non-blocking quiz bubble for the whole document
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("open-document-quiz", {
                detail: { documentIds: [documentId], chatId },
              })
            );
          }
          break;

        case "flashcards":
          // Generate flashcards
          await generateLessonFromDocument({
            documentId,
          });
          toast.success("Flashcards generated! Check the artifacts panel.");
          break;

        default:
          console.warn("Unknown PDF action type:", type);
      }
    } catch (error) {
      console.error("Error handling PDF action:", error);
      toast.error("Failed to execute action. Please try again.");
    }
  };

  return { handlePDFAction };
}
