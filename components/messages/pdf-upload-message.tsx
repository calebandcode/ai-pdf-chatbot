"use client";

import { motion } from "framer-motion";
import { FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  ContextualChatModal,
  type SelectionContext,
} from "@/components/contextual-chat-modal";
import { MagnifyingGlass } from "@/components/magnifying-glass";
import { NoteManager } from "@/components/note-manager";
import {
  createPDFSuggestionActions,
  type PDFSuggestionAction,
  PDFSuggestions,
} from "@/components/pdf-suggestions";
import { QuizFromTextModal } from "@/components/quiz-from-text-modal";
import { ReadingControlsBar } from "@/components/reading-controls-bar";
import { TextSelectionBubble } from "@/components/text-selection-bubble";
import { TipsCollection } from "@/components/tips-collection";
import { TopicOutline } from "@/components/topic-outline";
import { useFont } from "@/contexts/font-context";
import { usePDFActions } from "@/hooks/use-pdf-actions";
import { useTips } from "@/hooks/use-tips";
import { cn } from "@/lib/utils";

type PDFUploadMessageData = {
  documentTitle: string;
  pageCount: number;
  summary: string;
  mainTopics?: Array<{
    topic: string;
    description: string;
    pages: number[];
    subtopics?: Array<{
      subtopic: string;
      pages: number[];
    }>;
  }>;
  documentId: string;
  chatId: string;
  onAction?: (
    type: PDFSuggestionAction["type"],
    documentId: string,
    chatId: string
  ) => void;
};

type PDFUploadMessageProps = {
  data: PDFUploadMessageData;
  className?: string;
};

export function PDFUploadMessage({ data, className }: PDFUploadMessageProps) {
  const {
    documentTitle,
    pageCount,
    summary,
    mainTopics,
    documentId,
    chatId,
    onAction,
  } = data;
  const { handlePDFAction } = usePDFActions();

  // Text selection features
  const [showTipsCollection, setShowTipsCollection] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showContextualChat, setShowContextualChat] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [quizSource, setQuizSource] = useState<string | undefined>();
  const [chatContext, setChatContext] = useState<SelectionContext | null>(null);

  const { tips, deleteTip } = useTips();
  const { fontFamily, fontSize } = useFont();

  // Text selection handlers
  const handleHighlight = () => {
    // The highlighting is already handled in the TextSelectionBubble component
  };

  const handleQuizMe = (text: string) => {
    setSelectedText(text);
    setQuizSource(documentTitle);
    setShowQuizModal(true);
  };

  const handleQuizFromTip = (text: string) => {
    setSelectedText(text);
    setQuizSource("Saved Tip");
    setShowQuizModal(true);
  };

  const handleAskAboutThis = (_text: string, context: SelectionContext) => {
    setChatContext(context);
    setShowContextualChat(true);
  };

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
      className={cn("flex flex-col gap-4 transition-all", className)}
      initial={{ opacity: 0, y: 20 }}
      style={{
        fontSize: `${fontSize}px`,
        fontFamily:
          fontFamily === "inter"
            ? '"Inter", sans-serif'
            : fontFamily === "merriweather"
              ? '"Merriweather", serif'
              : fontFamily === "lora"
                ? '"Lora", serif'
                : fontFamily === "manrope"
                  ? '"Manrope", sans-serif'
                  : '"Roboto Mono", monospace',
      }}
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

      {/* Summary section - pure conversational text with subtle background */}
      <div className="rounded-lg bg-gray-50/30 p-4">
        <p className="text-sm leading-relaxed">{summary}</p>
      </div>

      {/* Topic Outline */}
      {mainTopics && mainTopics.length > 0 && (
        <div className="mt-4">
          <TopicOutline
            chatId={chatId}
            documentIds={[documentId]}
            topics={mainTopics}
          />
        </div>
      )}

      {/* Interactive suggestions */}
      <div>
        <h4 className="mb-3 font-medium text-muted-foreground text-sm">
          What would you like to do?
        </h4>
        <PDFSuggestions actions={suggestionActions} />
      </div>

      {/* Reading Controls Bar */}
      <ReadingControlsBar
        onTipsClick={() => setShowTipsCollection(true)}
        tipsCount={tips.length}
      />

      {/* Magnifying Glass */}
      <MagnifyingGlass />

      {/* Note Manager - wraps components that need note functionality */}
      <NoteManager source={documentTitle}>
        {(requestNote) => (
          <TextSelectionBubble
            onAddNote={(text, range, position) => {
              requestNote(text, range, position);
            }}
            onAskAboutThis={handleAskAboutThis}
            onHighlight={handleHighlight}
            onQuizMe={handleQuizMe}
            source={documentTitle}
          />
        )}
      </NoteManager>

      {/* Tips Collection Modal */}
      <TipsCollection
        isOpen={showTipsCollection}
        onClose={() => setShowTipsCollection(false)}
        onDeleteTip={deleteTip}
        onQuizFromTip={handleQuizFromTip}
        tips={tips}
      />

      {/* Quiz from Text Modal */}
      <QuizFromTextModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        selectedText={selectedText}
        source={quizSource}
      />

      {/* Contextual Chat Modal */}
      <ContextualChatModal
        context={chatContext}
        isOpen={showContextualChat}
        onClose={() => setShowContextualChat(false)}
      />
    </motion.div>
  );
}
