"use client";

import { motion } from "framer-motion";
import { FileText, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ContextualChatModal,
  type SelectionContext,
} from "@/components/contextual-chat-modal";
import { DiscoveryPanel } from "@/components/discovery-panel";
import { MagnifyingGlass } from "@/components/magnifying-glass";
import { NoteManager } from "@/components/note-manager";
import { QuizFromTextModal } from "@/components/quiz-from-text-modal";
import { ReadingControlsBar } from "@/components/reading-controls-bar";
import { TextSelectionBubble } from "@/components/text-selection-bubble";
import { TipsCollection } from "@/components/tips-collection";
import { TopicOutline } from "@/components/topic-outline";
import { useFont } from "@/contexts/font-context";
import { useTips } from "@/hooks/use-tips";
import type { DiscoveryResponse } from "@/lib/discovery/types";
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
  } = data;
  // Text selection features
  const [showTipsCollection, setShowTipsCollection] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showContextualChat, setShowContextualChat] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [quizSource, setQuizSource] = useState<string | undefined>();
  const [chatContext, setChatContext] = useState<SelectionContext | null>(null);
  const [discoveryState, setDiscoveryState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    data: DiscoveryResponse | null;
  }>({
    status: "idle",
    data: null,
  });
  const hasFetchedDiscoveryRef = useRef(false);

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

  const fetchDiscoveries = useCallback(async () => {
      if (!documentId) {
        return;
      }

      if (hasFetchedDiscoveryRef.current) {
        return;
      }

      setDiscoveryState((prev) => ({
        status: "loading",
        data: prev.data,
      }));

      try {
        const response = await fetch("/api/discovery", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId,
            documentTitle,
            summary,
            topics: (mainTopics || []).map((topic) => ({
              topic: topic.topic,
              description: topic.description,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch discovery resources");
        }

        const payload = (await response.json()) as DiscoveryResponse;
        setDiscoveryState({ status: "success", data: payload });
        hasFetchedDiscoveryRef.current = true;
      } catch (error) {
        console.error("[discovery] fetch failed", error);
        setDiscoveryState({ status: "error", data: null });
      }
    },
    [documentId, documentTitle, mainTopics, summary]
  );

  useEffect(() => {
    hasFetchedDiscoveryRef.current = false;
    setDiscoveryState({ status: "idle", data: null });
  }, [documentId]);

  useEffect(() => {
    fetchDiscoveries();
  }, [fetchDiscoveries]);

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

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-4 transition-all lg:mr-16 lg:max-w-3xl xl:max-w-4xl",
        className
      )}
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

      {/* Inline discovery for small screens */}
      <div className="lg:hidden">
        <DiscoveryPanel
          data={discoveryState.data}
          isError={discoveryState.status === "error"}
          isLoading={discoveryState.status === "loading"}
        />
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

      {/* Floating discovery panel for large screens */}
      <div className="pointer-events-none fixed right-4 bottom-24 z-30 hidden lg:block">
        <div className="pointer-events-auto w-80">
          <DiscoveryPanel
            data={discoveryState.data}
            isError={discoveryState.status === "error"}
            isLoading={discoveryState.status === "loading"}
          />
        </div>
      </div>

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
