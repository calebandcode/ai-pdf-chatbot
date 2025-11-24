import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";
import type { ChatContext } from "@/lib/db/schema";
import { useFont } from "@/contexts/font-context";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { DynamicGreeting } from "./dynamic-greeting";
import { Conversation, ConversationContent } from "./elements/conversation";
import { MagnifyingGlass } from "./magnifying-glass";
import { PreviewMessage, ThinkingMessage } from "./message";
import { NotebookCards } from "./notebook-cards";

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
};

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  selectedModelId,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
  } = useMessages({
    status,
  });
  
  // Track first source documentId to filter out additional sources
  const [firstSourceId, setFirstSourceId] = useState<string | null>(null);
  
  // Fetch chat context to determine first source
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const response = await fetch(`/api/chat/${chatId}/context`);
        if (response.ok) {
          const payload = await response.json();
          const context = payload.context;
          if (context?.sources && context.sources.length > 0) {
            // First source is the first one in the array
            setFirstSourceId(context.sources[0]?.documentId || null);
          }
        }
      } catch (error) {
        console.warn("Failed to fetch chat context:", error);
      }
    };
    
    fetchContext();
    
    // Also listen for refresh events
    const handleRefresh = () => {
      fetchContext();
    };
    
    window.addEventListener("refresh-messages", handleRefresh);
    return () => {
      window.removeEventListener("refresh-messages", handleRefresh);
    };
  }, [chatId]);

  const { fontFamily, fontSize } = useFont();

  useDataStream();

  useEffect(() => {
    if (status === "submitted") {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  return (
    <div
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch relative flex-1 touch-pan-y overflow-y-scroll scroll-smooth"
      ref={messagesContainerRef}
      style={{
        overflowAnchor: "none",
        scrollBehavior: "smooth",
        scrollPaddingTop: "1rem",
        scrollPaddingBottom: "8rem", // Match pb-32 to account for fixed input
      }}
    >
      {/* Bottom Fade Edge - Only show on chat page (when there are messages) */}
      {messages.length > 0 && (
        <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-20 h-8 bg-gradient-to-t from-background to-transparent" />
      )}
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6">
        <ConversationContent
          className="flex flex-col gap-4 px-2 py-4 pb-32 transition-all md:gap-6 md:px-4"
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
        >
          {messages.length === 0 && (
            <>
              <div className="mt-8">
                <NotebookCards />
              </div>
            </>
          )}

          {/* Render messages - filter out topic explanations and additional sources */}
          {messages
            .filter((message) => {
              // Filter out messages that are topic explanations
              // These should only appear in topic expansions and Edit Mode
              const hasTopicExplanation = message.parts?.some(
                (p) => (p as { type?: string }).type === "data-topicExplanation"
              );
              if (hasTopicExplanation) {
                return false;
              }
              
              // Filter out additional source messages (Option B: only first source should be displayed)
              const hasPdfUpload = message.parts?.some(
                (p) => (p as { type?: string }).type === "data-pdfUpload"
              );
              if (hasPdfUpload && firstSourceId) {
                // Check if this message's documentId matches the first source
                const pdfUploadPart = message.parts?.find(
                  (p) => (p as { type?: string }).type === "data-pdfUpload"
                );
                if (pdfUploadPart) {
                  const data = (pdfUploadPart as { data?: { documentId?: string } }).data;
                  const documentId = data?.documentId;
                  // Only show if this is the first source, or if we haven't determined first source yet
                  if (documentId && documentId !== firstSourceId) {
                    return false; // Hide additional sources
                  }
                }
              }
              
              return true;
            })
            .map((message, index) => {
              // Recalculate index after filtering
              const filteredMessages = messages.filter((m) => {
                const hasTopicExplanation = m.parts?.some(
                  (p) => (p as { type?: string }).type === "data-topicExplanation"
                );
                if (hasTopicExplanation) {
                  return false;
                }
                
                // Filter out additional sources
                const hasPdfUpload = m.parts?.some(
                  (p) => (p as { type?: string }).type === "data-pdfUpload"
                );
                if (hasPdfUpload && firstSourceId) {
                  const pdfUploadPart = m.parts?.find(
                    (p) => (p as { type?: string }).type === "data-pdfUpload"
                  );
                  if (pdfUploadPart) {
                    const data = (pdfUploadPart as { data?: { documentId?: string } }).data;
                    const documentId = data?.documentId;
                    if (documentId && documentId !== firstSourceId) {
                      return false;
                    }
                  }
                }
                
                return true;
              });
              
              return (
                <PreviewMessage
                  chatId={chatId}
                  isLoading={
                    status === "streaming" && index === filteredMessages.length - 1
                  }
                  isReadonly={isReadonly}
                  key={message.id}
                  message={message}
                  regenerate={regenerate}
                  requiresScrollPadding={
                    filteredMessages.length > 0 && index === filteredMessages.length - 1
                  }
                  setMessages={setMessages}
                  vote={
                    votes
                      ? votes.find((vote) => vote.messageId === message.id)
                      : undefined
                  }
                />
              );
            })}

          {status === "submitted" &&
            messages.length > 0 &&
            messages.at(-1)?.role === "user" &&
            selectedModelId !== "chat-model-reasoning" && <ThinkingMessage />}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </ConversationContent>
      </Conversation>

      <AnimatePresence>
        {!isAtBottom && (
          <motion.button
            animate={{ opacity: 1, scale: 1 }}
            aria-label="Scroll to bottom"
            className="-translate-x-1/2 fixed bottom-44 left-1/2 z-20 rounded-full border bg-background p-2 shadow-lg transition-colors hover:bg-muted"
            exit={{ opacity: 0, scale: 0.8 }}
            initial={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom("smooth")}
            transition={{ duration: 0.2, ease: "easeOut" }}
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowDownIcon className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Reading Controls Bar - Removed (mode toggle moved to HybridNotebookView) */}

      {/* Magnifying Glass */}
      <MagnifyingGlass />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) {
    return true;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.selectedModelId !== nextProps.selectedModelId) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  return false;
});
