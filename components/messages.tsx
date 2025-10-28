import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownIcon, BookOpen } from "lucide-react";
import { memo, useEffect, useState } from "react";
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
import { PreviewMessage, ThinkingMessage } from "./message";
import { NotebookCards } from "./notebook-cards";
import { QuizFromTextModal } from "./quiz-from-text-modal";
import { TextSelectionBubble } from "./text-selection-bubble";
import { TipsCollection } from "./tips-collection";
import { Button } from "./ui/button";

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
    setQuizSource("Chat");
    setShowQuizModal(true);
  };

  const handleAddNote = (text: string) => {
    const note = prompt("Add a note for this text:", "");
    if (note) {
      addTip(text, "Chat", note);
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
        <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
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
        source="Chat"
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
