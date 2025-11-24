"use client";
import { toast } from "sonner";
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
        case "generate_quiz":
        case "flashcards":
        default:
          toast.info("This action is currently unavailable.");
      }
    } catch (error) {
      console.error("Error handling PDF action:", error);
      toast.error("Failed to execute action. Please try again.");
    }
  };

  return { handlePDFAction };
}
