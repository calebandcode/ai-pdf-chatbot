"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { PartialBlock } from "@blocknote/core";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSavedBlocksAction } from "@/app/actions/save-block";

const SUMMARY_SPLIT_REGEX = /\n\n+/;

import {
  convertMergedContextToBlocks,
  convertSavedBlocksToBlocks,
} from "@/lib/blocknote/context-to-blocks";
import type { ChatContext, Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { UnifiedNotebookEditor } from "./blocknote/unified-notebook-editor";
import { Messages } from "./messages";
import type { ViewMode } from "./mode-toggle";
import { ReadingControlsBar } from "./reading-controls-bar";

/**
 * Extract ChatContext from messages as fallback when API fails
 */
function extractContextFromMessages(
  messages: ChatMessage[]
): ChatContext | null {
  const sources: ChatContext["sources"] = [];

  for (const message of messages) {
    if (message.role === "assistant" && message.parts) {
      for (const part of message.parts) {
        if ((part as { type?: string }).type === "data-pdfUpload") {
          const data = (
            part as {
              data?: {
                documentId?: string;
                documentTitle?: string;
                title?: string;
                summary?: string;
                mainTopics?: Array<{
                  topic: string;
                  description?: string;
                  pages?: number[];
                  subtopics?: Array<{
                    subtopic: string;
                    description?: string;
                    pages?: number[];
                  }>;
                }>;
              };
            }
          ).data;

          if (data?.documentId) {
            sources.push({
              documentId: data.documentId,
              title: data.documentTitle || data.title || "Untitled",
              summary: data.summary || "",
              mainTopics: data.mainTopics || [],
            });
          }
        }
      }
    }
  }

  if (sources.length === 0) {
    return null;
  }

  return {
    chatId: "", // Not needed for conversion
    sources,
    globalSummary: "",
    globalTopics: [],
    relationships: null,
    sourceCount: sources.length,
    lastSummaryRegeneration: null,
    deltaSummaries: null,
    updatedAt: new Date(),
  } as ChatContext;
}

type HybridNotebookViewProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
  onModeChange?: (mode: ViewMode) => void;
};

/**
 * Hybrid Notebook View - Prototype
 *
 * Demonstrates the concept of switching between:
 * - Agent Mode: Interactive learning experience (current Messages component)
 * - Edit Mode: Rich note-taking with BlockNote editor
 */
export function HybridNotebookView({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  selectedModelId,
  onModeChange,
}: HybridNotebookViewProps) {
  const [mode, setMode] = useState<ViewMode>("agent");

  // Notify parent when mode changes
  const handleModeChange = useCallback(
    (newMode: ViewMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
    },
    [onModeChange]
  );
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  // Fetch ChatContext (merged summary + topics)
  const fetchChatContext = useCallback(async () => {
    if (!chatId) {
      return;
    }

    try {
      const response = await fetch(`/api/chat/${chatId}/context`);
      if (response.ok) {
        const payload = await response.json();
        const contextData = payload.context as ChatContext | null;
        setChatContext(contextData);
        console.log(
          "✅ Chat context loaded:",
          contextData ? "has data" : "null"
        );
      } else {
        console.warn(
          "⚠️ Failed to fetch chat context - status:",
          response.status
        );
        // Set to null so Edit Mode can still work (will show empty state)
        setChatContext(null);
      }
    } catch (error) {
      console.warn("❌ Failed to fetch chat context:", error);
      // Set to null so Edit Mode can still work (will show empty state)
      setChatContext(null);
    }
  }, [chatId]);

  // Fetch context on mount and when messages change (new source added)
  useEffect(() => {
    fetchChatContext();
  }, [fetchChatContext]);

  // Also fetch context when switching to Edit Mode to ensure it's loaded
  useEffect(() => {
    if (mode === "edit" && !chatContext) {
      fetchChatContext();
    }
  }, [mode, chatContext, fetchChatContext]);

  // Listen for context refresh events (e.g., after adding a source or new explanation)
  useEffect(() => {
    const handleRefresh = async (event?: Event) => {
      const customEvent = event as CustomEvent | undefined;
      const eventChatId = customEvent?.detail?.chatId;

      // Only refresh if it's for this chat or no specific chatId was provided
      if (!eventChatId || eventChatId === chatId) {
        fetchChatContext();

        // Also refresh messages to get latest explanations
        try {
          const response = await fetch(`/api/chat/${chatId}/messages`);
          if (response.ok) {
            const latestMessages = await response.json();
            setMessages(latestMessages);
          }
        } catch (error) {
          console.warn("Failed to refresh messages:", error);
        }
      }
    };

    window.addEventListener("refresh-messages", handleRefresh);
    return () => {
      window.removeEventListener("refresh-messages", handleRefresh);
    };
  }, [chatId, fetchChatContext, setMessages]);

  // State for synthesized content (legacy - may be removed later)
  const [synthesizedContent, setSynthesizedContent] = useState<{
    unifiedTopics: Array<{
      unifiedName: string;
      unifiedDescription?: string;
      pages: number[];
      subtopics: Array<{
        subtopic: string;
        description?: string;
        pages: number[];
      }>;
      sourceTopics: Array<{
        sourceTitle: string;
        originalName: string;
        originalDescription?: string;
      }>;
    }>;
    synthesizedContent: Array<{
      topic: any;
      synthesizedExplanation: string;
      expanded: boolean;
      relatedQA: Array<{ question: string; answer: string }>;
    }>;
    organizedSections: Array<{
      sectionTitle: string;
      topics: any[];
      order: number;
    }>;
  } | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // State for saved blocks (new primary data source for Edit Mode)
  const [savedBlocks, setSavedBlocks] = useState<any[]>([]);
  const [isLoadingSavedBlocks, setIsLoadingSavedBlocks] = useState(false);

  // Load saved blocks when switching to Edit Mode
  useEffect(() => {
    if (mode === "edit") {
      const loadSavedBlocks = async () => {
        setIsLoadingSavedBlocks(true);
        try {
          const result = await getSavedBlocksAction(chatId);
          if (result.success && result.blocks) {
            setSavedBlocks(result.blocks);
          } else {
            setSavedBlocks([]);
          }
        } catch (error) {
          console.error("Failed to load saved blocks:", error);
          setSavedBlocks([]);
        } finally {
          setIsLoadingSavedBlocks(false);
        }
      };

      loadSavedBlocks();
    }
  }, [mode, chatId]);

  // Also reload saved blocks when refresh event is triggered
  useEffect(() => {
    const handleRefresh = async (event?: Event) => {
      const customEvent = event as CustomEvent | undefined;
      const eventChatId = customEvent?.detail?.chatId;

      if ((!eventChatId || eventChatId === chatId) && mode === "edit") {
        try {
          const result = await getSavedBlocksAction(chatId);
          if (result.success && result.blocks) {
            setSavedBlocks(result.blocks);
          }
        } catch (error) {
          console.error("Failed to refresh saved blocks:", error);
        }
      }
    };

    window.addEventListener("refresh-messages", handleRefresh);
    return () => {
      window.removeEventListener("refresh-messages", handleRefresh);
    };
  }, [chatId, mode]);

  // Legacy synthesis (kept for backward compatibility, but Edit Mode now uses saved blocks)
  useEffect(() => {
    if (
      mode === "edit" &&
      chatContext &&
      chatContext.sources &&
      chatContext.sources.length > 0 &&
      savedBlocks.length === 0 // Only synthesize if no saved blocks
    ) {
      const synthesizeContent = async () => {
        setIsSynthesizing(true);
        try {
          const { synthesizeEditModeContent } = await import(
            "@/app/actions/synthesize-edit-mode"
          );
          const documentIds =
            chatContext.sources?.map((s) => s.documentId) || [];
          const result = await synthesizeEditModeContent(
            chatContext,
            messages,
            documentIds
          );
          setSynthesizedContent(result);
        } catch (error) {
          console.error("Failed to synthesize Edit Mode content:", error);
        } finally {
          setIsSynthesizing(false);
        }
      };

      synthesizeContent();
    }
  }, [mode, chatContext, messages, savedBlocks.length]);

  // Convert saved blocks to blocks for Edit Mode
  const initialBlocks = useMemo(() => {
    const blocks: PartialBlock[] = [];

    if (mode === "edit") {
      console.log("🔍 Edit Mode - Generating blocks:", {
        savedBlocksCount: savedBlocks.length,
        hasSynthesizedContent: !!synthesizedContent,
        synthesizedSections: synthesizedContent?.organizedSections.length || 0,
        hasChatContext: !!chatContext,
        sourcesCount: chatContext?.sources?.length || 0,
        messagesCount: messages.length,
      });

      // Priority 1: Show document summary + saved blocks (if any)
      // In Edit Mode, we ONLY show: summary + user-saved content
      // NO topics, NO subtopics, NO topic structure
      if (chatContext?.sources && chatContext.sources.length > 0) {
        // Always show summary first
        const firstSource = chatContext.sources[0];
        if (firstSource?.title) {
          // Document title as main heading (no "Knowledge Overview")
          blocks.push({
            type: "heading",
            props: { level: 1 },
            content: [
              { type: "text", text: firstSource.title, styles: { bold: true } },
            ],
          });
          if (firstSource.summary?.trim()) {
            const summaryParagraphs = firstSource.summary
              .split(SUMMARY_SPLIT_REGEX)
              .filter((p) => p.trim());
            for (const para of summaryParagraphs) {
              if (para.trim()) {
                blocks.push({
                  type: "paragraph",
                  content: [{ type: "text", text: para.trim(), styles: {} }],
                });
              }
            }
          }
        }

        // Then add saved blocks if any (convertSavedBlocksToBlocks now returns only saved content, no summary)
        if (savedBlocks.length > 0) {
          const savedBlocksData = convertSavedBlocksToBlocks(
            savedBlocks,
            chatContext
          );
          // Add all saved blocks (they don't include summary anymore)
          blocks.push(...savedBlocksData);
          console.log("✅ Added saved blocks:", savedBlocks.length);
        }
      }
      // Priority 2: Skip synthesized content in Edit Mode - it shows all topics/subtopics
      // Edit Mode should ONLY show: summary + user-saved content
      // Synthesized content is for legacy compatibility but not used in Edit Mode
      // Priority 3: Fallback - extract sources from messages if context API failed
      else if (messages.length > 0) {
        console.log("⚠️ No chatContext, extracting from messages as fallback");
        const extractedContext = extractContextFromMessages(messages);
        if (extractedContext && extractedContext.sources.length > 0) {
          console.log(
            "📚 Extracted sources from messages:",
            extractedContext.sources
          );
          const documentIds =
            extractedContext.sources.map((s) => s.documentId) || [];
          const contextBlocks = convertMergedContextToBlocks(
            extractedContext,
            messages,
            documentIds,
            true // forEditMode = true (only show summary, not topics)
          );
          if (contextBlocks.length > 0) {
            blocks.push(...contextBlocks);
            console.log(
              "✅ Generated blocks from extracted context (summary only):",
              contextBlocks.length
            );
          }
        } else {
          console.warn("⚠️ Could not extract context from messages");
        }
      } else {
        console.warn(
          "⚠️ No content available - chatContext:",
          chatContext,
          "messages:",
          messages.length
        );
      }
    } else if (mode === "agent" && chatContext) {
      // Agent Mode: use simple conversion (for backward compatibility)
      const documentIds = chatContext.sources?.map((s) => s.documentId) || [];
      const contextBlocks = convertMergedContextToBlocks(
        chatContext,
        messages,
        documentIds,
        false // forEditMode = false (show everything in Agent Mode)
      );
      blocks.push(...contextBlocks);
    }

    // CRITICAL: In Edit Mode, filter out ALL topic blocks and topic/subtopic headings
    // Edit Mode should ONLY show: document summary + saved content
    // NO topic structure, NO topic blocks, NO "Knowledge Overview", NO topic/subtopic headings
    if (mode === "edit") {
      // Get all topic and subtopic names from chatContext to identify topic headings
      const topicNames = new Set<string>();
      const subtopicNames = new Set<string>();

      if (chatContext?.sources) {
        for (const source of chatContext.sources) {
          for (const topic of source.mainTopics || []) {
            topicNames.add(topic.topic.toLowerCase().trim());
            for (const subtopic of topic.subtopics || []) {
              subtopicNames.add(subtopic.subtopic.toLowerCase().trim());
            }
          }
        }
      }

      const filteredBlocks = blocks.filter((block) => {
        const blockType = block.type as string;

        // Filter out topicExplanation blocks - these are topic/subtopic structures
        if (blockType === "topicExplanation") {
          console.log("🚫 Filtered out topic block in Edit Mode:", block);
          return false;
        }

        // Filter out headings that are topics/subtopics or "Knowledge Overview"
        if (blockType === "heading" && block.content) {
          let headingText = "";
          if (Array.isArray(block.content)) {
            headingText = block.content
              .map((c: unknown) => {
                if (typeof c === "object" && c !== null && "text" in c) {
                  return (c as { text?: string }).text || "";
                }
                return "";
              })
              .join("")
              .trim();
          } else if (typeof block.content === "string") {
            headingText = block.content.trim();
          }

          // Filter out "Knowledge Overview"
          if (headingText === "Knowledge Overview") {
            console.log(
              "🚫 Filtered out 'Knowledge Overview' heading in Edit Mode"
            );
            return false;
          }

          // Filter out topic headings (level 2 headings that match topic names)
          const headingLevel = (block.props as { level?: number })?.level;
          if (
            headingLevel === 2 &&
            topicNames.has(headingText.toLowerCase().trim())
          ) {
            console.log(
              "🚫 Filtered out topic heading in Edit Mode:",
              headingText
            );
            return false;
          }

          // Filter out subtopic headings (level 3 headings that match subtopic names)
          if (
            headingLevel === 3 &&
            subtopicNames.has(headingText.toLowerCase().trim())
          ) {
            console.log(
              "🚫 Filtered out subtopic heading in Edit Mode:",
              headingText
            );
            return false;
          }
        }

        return true;
      });
      console.log(
        "📝 Final blocks count (after filtering topics):",
        filteredBlocks.length,
        "out of",
        blocks.length
      );
      return filteredBlocks;
    }

    console.log("📝 Final blocks count:", blocks.length);
    return blocks;
  }, [mode, savedBlocks, synthesizedContent, chatContext, messages]);

  // Only show toggle when there's content (notebook is open)
  const hasContent = messages.length > 0 || initialBlocks.length > 0;

  return (
    <>
      {/* Content Area - Full height, scrolls independently */}
      <div className="relative h-full w-full">
        <AnimatePresence mode="wait">
          {mode === "agent" ? (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="absolute inset-0"
              exit={{ opacity: 0, x: -20 }}
              initial={{ opacity: 0, x: 20 }}
              key="agent"
              transition={{ duration: 0.2 }}
            >
              <Messages
                chatId={chatId}
                isArtifactVisible={isArtifactVisible}
                isReadonly={isReadonly}
                messages={messages}
                regenerate={regenerate}
                selectedModelId={selectedModelId}
                setMessages={setMessages}
                status={status}
                votes={votes}
              />
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="absolute inset-0 overflow-y-auto"
              exit={{ opacity: 0, x: 20 }}
              initial={{ opacity: 0, x: -20 }}
              key="edit"
              transition={{ duration: 0.2 }}
            >
              <div className="mx-auto max-w-4xl px-4 py-6 pb-32">
                {isLoadingSavedBlocks || isSynthesizing ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground text-sm">
                      {isLoadingSavedBlocks
                        ? "Loading your notebook..."
                        : "Organizing your knowledge..."}
                    </p>
                    <p className="mt-2 text-muted-foreground text-xs">
                      {isLoadingSavedBlocks
                        ? "Fetching saved content"
                        : "Merging topics and synthesizing content"}
                    </p>
                  </div>
                ) : initialBlocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <p className="text-muted-foreground text-sm">
                      {chatContext?.sources && chatContext.sources.length > 0
                        ? "Loading content..."
                        : "No content available yet."}
                    </p>
                    <p className="mt-2 text-muted-foreground text-xs">
                      {chatContext?.sources && chatContext.sources.length > 0
                        ? "Please wait while we prepare your notebook."
                        : "Add sources in Agent Mode to create your notebook."}
                    </p>
                  </div>
                ) : (
                  <UnifiedNotebookEditor
                    autoSave={true}
                    autoSaveDelay={1000}
                    chatId={chatId}
                    editable={!isReadonly}
                    initialBlocks={initialBlocks}
                    onBlocksChange={() => {
                      // Blocks are auto-saved
                    }}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mode Toggle - Fixed position (replaces font selector) */}
      <ReadingControlsBar
        hasContent={hasContent}
        mode={mode}
        onModeChange={handleModeChange}
      />
    </>
  );
}
