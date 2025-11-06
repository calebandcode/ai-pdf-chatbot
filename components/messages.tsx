import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownIcon, Sparkles } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useFont } from "@/contexts/font-context";
import { useMessages } from "@/hooks/use-messages";
import { useTips } from "@/hooks/use-tips";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import {
  ContextualChatModal,
  type SelectionContext,
} from "./contextual-chat-modal";
import { useDataStream } from "./data-stream-provider";
import { DynamicGreeting } from "./dynamic-greeting";
import { Conversation, ConversationContent } from "./elements/conversation";
import { MagnifyingGlass } from "./magnifying-glass";
import { PreviewMessage } from "./message";
import { NoteManager } from "./note-manager";
import { NotebookCards } from "./notebook-cards";
import { QuizFromTextModal } from "./quiz-from-text-modal";
import { ReadingControlsBar } from "./reading-controls-bar";
import { AIThinking } from "./streaming/typing-indicator";
import { TextSelectionBubble } from "./text-selection-bubble";
import { TipsCollection } from "./tips-collection";

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
    hasSentMessage,
  } = useMessages({
    status,
  });

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
    setQuizSource("Chat");
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
        scrollPaddingBottom: "1rem",
      }}
    >
      {/* Bottom Fade Edge - Only show on chat page (when there are messages) */}
      {messages.length > 0 && (
        <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-20 h-8 bg-gradient-to-t from-background to-transparent" />
      )}
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6">
        <ConversationContent
          className="flex flex-col gap-4 px-2 py-4 transition-all md:gap-6 md:px-4"
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
              <DynamicGreeting />
              <div className="mt-8">
                <NotebookCards />
              </div>
            </>
          )}

          {messages.map((message, index) => (
            <PreviewMessage
              chatId={chatId}
              isLoading={
                status === "streaming" && messages.length - 1 === index
              }
              isReadonly={isReadonly}
              key={message.id}
              message={message}
              regenerate={regenerate}
              requiresScrollPadding={
                hasSentMessage && index === messages.length - 1
              }
              setMessages={setMessages}
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
            />
          ))}

          {status === "submitted" &&
            messages.length > 0 &&
            messages.at(-1)?.role === "user" &&
            selectedModelId !== "chat-model-reasoning" && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
                exit={{ opacity: 0, y: -10 }}
                initial={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <Sparkles size={14} />
                </div>
                <div className="flex w-full flex-col gap-2 md:gap-4">
                  <div className="p-0 text-muted-foreground text-sm">
                    <AIThinking message="AI is thinking..." />
                  </div>
                </div>
              </motion.div>
            )}

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

      {/* Reading Controls Bar */}
      <ReadingControlsBar
        onTipsClick={() => setShowTipsCollection(true)}
        tipsCount={tips.length}
      />

      {/* Magnifying Glass */}
      <MagnifyingGlass />

      {/* Note Manager - wraps components that need note functionality */}
      <NoteManager source="Chat">
        {(requestNote) => (
          <TextSelectionBubble
            onAddNote={(text, range, position) => {
              requestNote(text, range, position);
            }}
            onAskAboutThis={handleAskAboutThis}
            onHighlight={handleHighlight}
            onQuizMe={handleQuizMe}
            source="Chat"
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
