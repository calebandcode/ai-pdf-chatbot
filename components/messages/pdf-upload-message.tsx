"use client";

import { motion } from "framer-motion";
import { FileText, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ContextualChatModal,
  type SelectionContext,
} from "@/components/contextual-chat-modal";
import { MagnifyingGlass } from "@/components/magnifying-glass";
import { NoteManager } from "@/components/note-manager";
import { QuizFromTextModal } from "@/components/quiz-from-text-modal";
// ReadingControlsBar removed - mode toggle now in HybridNotebookView
import { TextSelectionBubble } from "@/components/text-selection-bubble";
import { TipsCollection } from "@/components/tips-collection";
import { TopicOutline } from "@/components/topic-outline";
import { useFont } from "@/contexts/font-context";
import { useTips } from "@/hooks/use-tips";
import type { DiscoveryResponse } from "@/lib/discovery/types";
import type { ChatContext } from "@/lib/db/schema";
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
  const [mergedChatContext, setMergedChatContext] = useState<ChatContext | null>(null);
  const [isFirstSource, setIsFirstSource] = useState<boolean | null>(null);
  const [discoveryState, setDiscoveryState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    data: DiscoveryResponse | null;
  }>({
    status: "idle",
    data: null,
  });
  const hasFetchedDiscoveryRef = useRef(false);
  const hasFetchedContextRef = useRef(false);

  const { fontFamily, fontSize } = useFont();

  // Fetch merged chat context to determine if we should show merged summary/topics
  const fetchChatContext = useCallback(async () => {
    if (!chatId) {
      return;
    }

    try {
      const response = await fetch(`/api/chat/${chatId}/context`);
      if (response.ok) {
        const payload = await response.json();
        const contextData = payload.context as ChatContext | null;
        setMergedChatContext(contextData);
        
        // Determine if we should show merged content:
        // - If context has multiple sources, show merged content only for the FIRST source
        // - Otherwise, show individual content
        if (contextData && contextData.sources && contextData.sources.length > 1) {
          // Check if this documentId is the first source in the array
          const firstSourceId = contextData.sources[0]?.documentId;
          setIsFirstSource(firstSourceId === documentId);
        } else {
          // Single source or no context - this is the first/only source
          setIsFirstSource(true);
        }
      } else {
        // No context yet - assume this is the first source
        setIsFirstSource(true);
      }
    } catch (error) {
      console.warn("Failed to fetch chat context:", error);
      // If context fetch fails, assume this is the first source
      setIsFirstSource(true);
    }
  }, [chatId, documentId]);

  // Refresh context when messages are updated (e.g., after adding a source)
  useEffect(() => {
    const handleRefresh = () => {
      hasFetchedContextRef.current = false;
      fetchChatContext();
    };
    
    window.addEventListener("refresh-messages", handleRefresh);
    return () => {
      window.removeEventListener("refresh-messages", handleRefresh);
    };
  }, [fetchChatContext]);

  useEffect(() => {
    fetchChatContext();
  }, [fetchChatContext]);


  const fetchDiscoveries = useCallback(async () => {
      // Only fetch discoveries for the first source
      // Wait for context to be loaded (isFirstSource !== null) before deciding
      if (!documentId || isFirstSource === false) {
        return;
      }

      // If context is still loading, wait
      if (isFirstSource === null && mergedChatContext === null) {
        return;
      }

      if (hasFetchedDiscoveryRef.current) {
        return;
      }

      setDiscoveryState((prev) => ({
        status: "loading",
        data: prev.data,
      }));

      // Option B: Use first source's individual topics (no merging)
      const topicsToUse = mainTopics;

      try {
        const response = await fetch("/api/discovery", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId,
            documentTitle,
            summary: summary,  // Option B: Use first source's individual summary
            topics: (topicsToUse || []).map((topic) => ({
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
    [documentId, documentTitle, isFirstSource, mergedChatContext, summary, mainTopics]
  );

  useEffect(() => {
    hasFetchedDiscoveryRef.current = false;
    setDiscoveryState({ status: "idle", data: null });
  }, [documentId, isFirstSource]);

  useEffect(() => {
    fetchDiscoveries();
  }, [fetchDiscoveries]);

  // Option B: Only show first source's content, additional sources are hidden but used for context
  // - If this is the first source: show its individual summary/topics
  // - If this is NOT the first source: show only document card (no summary/topics)
  // - While loading (isFirstSource === null), assume this is the first source to show content immediately
  const shouldShowFullContent = isFirstSource !== false; // Show content unless we know for sure it's not the first source
  
  // Use first source's individual content (Option B: no merging)
  const displaySummary = shouldShowFullContent ? summary : null;
  const displayTopics = shouldShowFullContent ? mainTopics : null;
  
  // For Q&A and explanations, use ALL sources (including additional ones)
  const allDocumentIds = mergedChatContext?.sources
    ? mergedChatContext.sources.map(s => s.documentId)
    : (shouldShowFullContent ? [documentId] : []);

  console.log("🎨 Rendering PDF Upload Message:", {
    documentTitle,
    pageCount,
    isFirstSource,
    shouldShowFullContent,
    hasMergedContext: !!mergedChatContext,
    sourceCount: mergedChatContext?.sources?.length ?? 0,
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
              {pageCount} {pageCount === 1 ? 'page' : 'pages'}
            </span>
          </div>
          {shouldShowFullContent && (
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Sparkles className="h-3 w-3" />
              <span>AI Tutor Analysis Complete</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary section - only show for first source */}
      {displaySummary && (
        <div className="rounded-lg bg-gray-50/30 p-4">
          <p className="text-sm leading-relaxed">{displaySummary}</p>
        </div>
      )}

      {/* Topic Outline - only show for first source */}
      {displayTopics && displayTopics.length > 0 && (
        <div className="mt-4">
          <TopicOutline
            chatId={chatId}
            documentIds={allDocumentIds}
            topics={displayTopics}
          />
        </div>
      )}

      {/* Reading Controls Bar - Removed (mode toggle moved to HybridNotebookView) */}
      {shouldShowFullContent && (
        <>
          {/* Magnifying Glass */}
          <MagnifyingGlass />
        </>
      )}

      {/* Discovery panel hidden in game-focused pivot */}

    </motion.div>
  );
}
