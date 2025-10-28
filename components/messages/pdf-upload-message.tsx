"use client";

import { motion } from "framer-motion";
import { BookOpen, FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  ContextualChatModal,
  type SelectionContext,
} from "@/components/contextual-chat-modal";
import {
  createPDFSuggestionActions,
  type PDFSuggestionAction,
  PDFSuggestions,
} from "@/components/pdf-suggestions";
import { QuizFromTextModal } from "@/components/quiz-from-text-modal";
import { TextSelectionBubble } from "@/components/text-selection-bubble";
import { TipsCollection } from "@/components/tips-collection";
import { TopicOutline } from "@/components/topic-outline";
import { Button } from "@/components/ui/button";
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

  const { tips, addTip, deleteTip } = useTips();

  // Text selection handlers
  const handleHighlight = (_text: string, _range: Range) => {
    console.log("Highlighting text:", _text);
    // The highlighting is already handled in the TextSelectionBubble component
  };

  const handleSaveTip = (text: string, source?: string) => {
    addTip(text, source);
    console.log("Tip saved:", { text, source });
  };

  const handleQuizMe = (text: string) => {
    setSelectedText(text);
    setQuizSource(documentTitle);
    setShowQuizModal(true);
  };

  const handleAddNote = (text: string) => {
    const note = prompt("Add a note for this text:", "");
    if (note) {
      addTip(text, documentTitle, note);
    }
  };

  const handleQuizFromTip = (text: string) => {
    setSelectedText(text);
    setQuizSource("Saved Tip");
    setShowQuizModal(true);
  };

  const handleAskAboutThis = (text: string, context: SelectionContext) => {
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

      {/* Floating Tips Button */}
      {tips.length > 0 && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="fixed right-4 bottom-20 z-40"
          initial={{ opacity: 0, scale: 0.8 }}
        >
          <Button
            className="rounded-full shadow-lg transition-all duration-200 hover:shadow-xl"
            onClick={() => setShowTipsCollection(true)}
            size="sm"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            My Tips ({tips.length})
          </Button>
        </motion.div>
      )}

      {/* Text Selection Features */}
      <TextSelectionBubble
        onAddNote={handleAddNote}
        onAskAboutThis={handleAskAboutThis}
        onHighlight={handleHighlight}
        onQuizMe={handleQuizMe}
        onSaveTip={handleSaveTip}
        source={documentTitle}
      />

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
