"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

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

  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case "pdf":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      case "website":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "text":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  if (!isOpen || !context) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-gray-200 border-b p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-indigo-600" />
              <div>
                <h2 className="font-semibold text-lg">
                  Ask about this section
                </h2>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    className={`text-xs ${getSourceTypeColor(context.sourceType)}`}
                  >
                    {getSourceTypeIcon(context.sourceType)}{" "}
                    {context.sourceType.toUpperCase()}
                  </Badge>
                  <span className="max-w-xs truncate text-gray-500 text-sm">
                    {context.sourceTitle}
                  </span>
                </div>
              </div>
            </div>
            <Button onClick={onClose} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected Text Context */}
          <div className="border-gray-100 border-b bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-700/30">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30">
                📝
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-gray-600 text-sm dark:text-gray-400">
                  Selected text:
                </p>
                <blockquote className="border-indigo-200 border-l-3 bg-white py-2 pl-4 text-gray-800 italic dark:border-indigo-700 dark:bg-gray-800 dark:text-gray-200">
                  "{context.selectedText}"
                </blockquote>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="max-h-96 flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
                  Ready to discuss this section!
                </h3>
                <p className="text-gray-500 text-sm dark:text-gray-400">
                  Ask anything about the selected text and I'll provide
                  context-aware answers.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    key={message.id}
                  >
                    <Card
                      className={`max-w-[80%] ${
                        message.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-50 dark:bg-gray-700"
                      }`}
                    >
                      <CardContent className="p-3">
                        {message.role === "assistant" && (
                          <div className="mb-2 flex items-center gap-2 text-gray-500 text-xs dark:text-gray-400">
                            <span className="font-medium">
                              🧠 AI responding to:
                            </span>
                            <span className="truncate">
                              "{context.selectedText.slice(0, 30)}..."
                            </span>
                          </div>
                        )}
                        <p
                          className={`text-sm ${
                            message.role === "user"
                              ? "text-white"
                              : "text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {message.content}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <Card className="bg-gray-50 dark:bg-gray-700">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <div className="flex space-x-1">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                            <div className="animation-delay-200 h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                            <div className="animation-delay-400 h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                          </div>
                          <span>AI is thinking...</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-gray-200 border-t p-4 dark:border-gray-700">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                disabled={isLoading}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask something about this section..."
                value={inputValue}
              />
              <Button
                disabled={!inputValue.trim() || isLoading}
                onClick={handleSendMessage}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
