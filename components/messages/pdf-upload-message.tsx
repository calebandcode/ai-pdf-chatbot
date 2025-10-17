"use client";

import { motion } from "framer-motion";
import { FileText, Sparkles } from "lucide-react";
import {
  createPDFSuggestionActions,
  type PDFSuggestionAction,
  PDFSuggestions,
} from "@/components/pdf-suggestions";
import { usePDFActions } from "@/hooks/use-pdf-actions";
import { cn } from "@/lib/utils";

interface PDFUploadMessageData {
  documentTitle: string;
  pageCount: number;
  summary: string;
  documentId: string;
  chatId: string;
  onAction?: (
    type: PDFSuggestionAction["type"],
    documentId: string,
    chatId: string
  ) => void;
}

interface PDFUploadMessageProps {
  data: PDFUploadMessageData;
  className?: string;
}

export function PDFUploadMessage({ data, className }: PDFUploadMessageProps) {
  const { documentTitle, pageCount, summary, documentId, chatId, onAction } =
    data;
  const { handlePDFAction } = usePDFActions();

  console.log("🎨 Rendering PDF Upload Message:", {
    documentTitle,
    pageCount,
    summaryLength: summary.length,
    documentId,
    chatId,
  });

  const handleAction = (
    type: PDFSuggestionAction["type"],
    docId: string,
    cId: string
  ) => {
    if (onAction) {
      onAction(type, docId, cId);
    } else {
      // Use the PDF actions hook for default behavior
      handlePDFAction(type, docId, cId);
    }
  };

  const suggestionActions = createPDFSuggestionActions(
    documentId,
    chatId,
    handleAction
  );

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-4", className)}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header with document info */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">{documentTitle}</h3>
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
              {pageCount} pages
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Sparkles className="h-3 w-3" />
            <span>AI Tutor Analysis Complete</span>
          </div>
        </div>
      </div>

      {/* Summary section */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <h4 className="mb-2 font-medium text-muted-foreground text-sm">
          Summary
        </h4>
        <p className="text-sm leading-relaxed">{summary}</p>
      </div>

      {/* Interactive suggestions */}
      <div>
        <h4 className="mb-3 font-medium text-muted-foreground text-sm">
          What would you like to do?
        </h4>
        <PDFSuggestions actions={suggestionActions} />
      </div>
    </motion.div>
  );
}
