"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
// Removed unused Button import

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
  const panelRef = useRef<HTMLDivElement>(null);

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
        const panelWidth = 320; // Approximate panel width

        let x = rect.right + 16; // 16px gap from selection
        if (spaceOnRight < panelWidth + 32) {
          x = rect.left - panelWidth - 16; // Position to the left instead
        }

        // Vertically center with the selection, but keep within viewport
        let y = rect.top + rect.height / 2 - 200; // Approximate half panel height
        y = Math.max(16, Math.min(y, window.innerHeight - 400 - 16));

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

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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

      setMessages((prev) => [...prev, assistantMessage]);
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

  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return "📄";
      case "website":
        return "🌐";
      case "text":
        return "📝";
      default:
        return "📄";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!isOpen || !context) {
    return null;
  }

  return (
    <AnimatePresence>
      {/* Minimal Tooltip Panel - No overlay, positioned beside selection */}
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="fixed z-50 w-80 rounded-sm border border-gray-100 bg-white shadow-lg transition-all duration-200 hover:border-gray-200"
        exit={{ opacity: 0, scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
        style={{
          left: position.x,
          top: position.y,
          maxHeight: "400px",
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Header - Notebook card style */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-sm bg-gray-50 p-1">
              <MessageCircle className="h-3 w-3 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-normal text-gray-900 text-sm">
                Ask about this
              </h3>
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <span>{getSourceTypeIcon(context.sourceType)}</span>
                <span className="truncate">{context.sourceTitle}</span>
              </div>
            </div>
          </div>
          <button
            className="rounded-sm p-1 text-gray-400 hover:text-gray-600"
            onClick={onClose}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Selected Text Quote - Subtle style */}
        <div className="mx-4 mb-3 rounded-sm border-gray-200 border-l-2 bg-gray-50 px-3 py-2">
          <p className="text-gray-600 text-xs italic leading-relaxed">
            "
            {context.selectedText.length > 100
              ? `${context.selectedText.slice(0, 100)}...`
              : context.selectedText}
            "
          </p>
        </div>

        {/* Messages Area - Compact */}
        <div className="max-h-48 overflow-y-auto px-4">
          {messages.length === 0 ? (
            <div className="py-4 text-center">
              <div className="mb-2 flex justify-center">
                <div className="rounded-full bg-gray-100 p-2">
                  <Sparkles className="h-4 w-4 text-gray-500" />
                </div>
              </div>
              <p className="text-gray-500 text-xs">
                Ask me anything about this text
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {messages.map((message) => (
                <div
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  key={message.id}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      message.role === "user"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p className="leading-relaxed">{message.content}</p>
                    <div
                      className={`mt-1 text-xs ${
                        message.role === "user"
                          ? "text-gray-300"
                          : "text-gray-500"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing Indicator - Minimal */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-gray-100 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                      </div>
                      <span className="text-gray-500 text-xs">
                        AI thinking...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area - Compact */}
        <div className="border-gray-100 border-t p-3">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-sm border border-gray-200 bg-white px-3 py-2 text-xs focus:border-gray-300 focus:outline-none"
              disabled={isLoading}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about this text..."
              ref={inputRef}
              value={inputValue}
            />
            <button
              className={`rounded-sm p-2 text-xs transition-colors ${
                inputValue.trim() && !isLoading
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-gray-100 text-gray-400"
              }`}
              disabled={!inputValue.trim() || isLoading}
              onClick={handleSendMessage}
              type="button"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
