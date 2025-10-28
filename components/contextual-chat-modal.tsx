"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, MessageCircle, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTips } from "@/hooks/use-tips";

export type SelectionContext = {
  selectedText: string;
  surroundingContext: string;
  sourceTitle: string;
  sourceType: "pdf" | "website" | "text";
  sourceId?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ContextualChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  context: SelectionContext | null;
};

export function ContextualChatModal({
  isOpen,
  onClose,
  context,
}: ContextualChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addTip } = useTips();
  const panelRef = useRef<HTMLDivElement>(null);

  const handleSaveResponse = (responseText: string) => {
    if (!context) {
      return;
    }

    addTip(
      responseText,
      `${context.sourceType}: ${context.sourceTitle}`,
      `AI response about: "${context.selectedText.slice(0, 50)}${context.selectedText.length > 50 ? "..." : ""}"`
    );
    toast.success("Response saved to your tips!");
  };

  // Calculate optimal position beside the selected text
  useEffect(() => {
    if (isOpen && context) {
      // Get the current text selection to position the tooltip
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position to the right of selection, or left if not enough space
        const spaceOnRight = window.innerWidth - rect.right;
        const panelWidth = 500; // Updated to match actual panel width

        let x = rect.right + 12; // Reduced gap from selection
        if (spaceOnRight < panelWidth + 24) {
          x = rect.left - panelWidth - 12; // Position to the left instead
        }

        // Better vertical positioning - align with selection top
        let y = rect.top - 10; // Small offset above selection
        y = Math.max(10, Math.min(y, window.innerHeight - 500 - 10));

        setPosition({ x, y });
      }
    }
  }, [isOpen, context]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Focus input and clear messages when modal opens (new selection)
  useEffect(() => {
    if (isOpen) {
      // Clear any previous messages for clean slate
      setMessages([]);
      setInputValue("");
      setIsLoading(false);

      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleQuickAction = async (action: string) => {
    if (!context || isLoading) {
      return;
    }

    let prompt = "";
    switch (action) {
      case "explain":
        prompt = `Explain this text in simple terms: "${context.selectedText}"`;
        break;
      case "simplify":
        prompt = `Simplify this text for easier understanding: "${context.selectedText}"`;
        break;
      case "quiz":
        prompt = `Create a quick quiz question about: "${context.selectedText}"`;
        break;
      case "examples":
        prompt = `Give practical examples related to: "${context.selectedText}"`;
        break;
      default:
        return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/contextual-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: prompt,
          context,
          conversationHistory: [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const result = await response.json();

      const aiMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };

      setMessages([aiMessage]); // Replace any previous message
    } catch (error) {
      console.error("Error in contextual chat:", error);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !context || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/contextual-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userMessage.content,
          context,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages([assistantMessage]); // Replace any previous message
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen || !context) {
    return null;
  }

  return (
    <AnimatePresence>
      {/* Click outside overlay to close */}
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-40"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key="contextual-chat-overlay"
        onClick={onClose}
      />

      {/* Main Panel - Response and Input together */}
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="fixed z-50 w-[500px] rounded-lg border border-gray-200 bg-white shadow-xl"
        exit={{ opacity: 0, scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.95 }}
        key="contextual-chat-main-panel"
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
        style={{
          left: position.x,
          top: position.y,
          maxHeight: "600px",
        }}
        transition={{ duration: 0.2 }}
      >
        {/* AI Response Area - ABOVE input like Notion */}
        {(messages.length > 0 || isLoading) && (
          <div className="border-gray-200 border-b p-4">
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
                  </div>
                  <span className="text-sm">AI is thinking...</span>
                </div>
              ) : (
                messages.length > 0 && (
                  <div className="group relative">
                    <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed">
                      {messages.at(-1)?.content}
                    </div>
                    {/* Save Button - appears on hover like copy button in main chat */}
                    <div className="-right-1 absolute top-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        className="size-8 p-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          handleSaveResponse(messages.at(-1)?.content || "")
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Bookmark size={14} />
                        <span className="sr-only">Save to tips</span>
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Input Area - Shorter height, maximum width like Notion */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-1">
            <input
              className="flex-1 border-0 bg-transparent px-1 py-1 text-gray-900 text-sm placeholder-gray-400 focus:outline-none"
              disabled={isLoading}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask AI anything..."
              ref={inputRef}
              value={inputValue}
            />
            {inputValue.trim() && (
              <button
                className="rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                disabled={isLoading}
                onClick={handleSendMessage}
                type="button"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Separate Suggestions Panel - Narrower like Notion dropdown */}
      {!messages.length && !isLoading && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-lg"
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          key="contextual-chat-suggestions-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            left: position.x,
            top: position.y + 60, // Even closer spacing
          }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <div className="px-4 py-3">
            <div className="mb-2 font-medium text-gray-500 text-xs">
              Suggested
            </div>
            <div className="space-y-1">
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-gray-700 text-sm hover:bg-gray-50"
                onClick={() => handleQuickAction("explain")}
                type="button"
              >
                <Sparkles className="h-4 w-4 text-purple-500" />
                Explain this
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-gray-700 text-sm hover:bg-gray-50"
                onClick={() => handleQuickAction("simplify")}
                type="button"
              >
                <MessageCircle className="h-4 w-4 text-blue-500" />
                Simplify
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-gray-700 text-sm hover:bg-gray-50"
                onClick={() => handleQuickAction("quiz")}
                type="button"
              >
                <span className="flex h-4 w-4 items-center justify-center text-green-500">
                  🧠
                </span>
                Quiz me on this
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-gray-700 text-sm hover:bg-gray-50"
                onClick={() => handleQuickAction("examples")}
                type="button"
              >
                <span className="flex h-4 w-4 items-center justify-center text-orange-500">
                  💡
                </span>
                Give examples
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
