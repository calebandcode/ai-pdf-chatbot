"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Brain,
  Lightbulb,
  MessageCircle,
  Reply,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTips } from "@/hooks/use-tips";
import { MinimalLoading } from "./loading/minimal-loading";
import { StreamingText } from "./streaming/typing-text";
import { AIThinking } from "./streaming/typing-indicator";

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
  previousQuestions?: string[];
  onSaveConversation?: (conversation: {
    id: string;
    question: string;
    answer: string;
    timestamp: Date;
  }) => void;
  clickPosition?: {
    x: number;
    y: number;
  };
};

export function ContextualChatModal({
  isOpen,
  onClose,
  context,
  previousQuestions = [],
  onSaveConversation,
  clickPosition,
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

  // Calculate optimal position beside the selected text or near click position
  useEffect(() => {
    if (isOpen && context) {
      if (onSaveConversation && clickPosition) {
        // For topic/subtopic chat, position near the clicked button
        const panelWidth = 500;
        const panelHeight = 400;
        
        let x = clickPosition.x - panelWidth / 2; // Center horizontally on click
        let y = clickPosition.y; // Position below the click
        
        // Ensure it stays within screen bounds
        x = Math.max(10, Math.min(x, window.innerWidth - panelWidth - 10));
        y = Math.max(10, Math.min(y, window.innerHeight - panelHeight - 10));
        
        setPosition({ x, y });
      } else if (onSaveConversation) {
        // Fallback: center on screen if no click position
        const x = (window.innerWidth - 500) / 2;
        const y = (window.innerHeight - 400) / 2;
        setPosition({ x, y });
      } else {
        // For regular "Ask about this", position near selection
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
    }
  }, [isOpen, context, onSaveConversation, clickPosition]);

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
      
      // Save conversation if callback provided
      if (onSaveConversation) {
        onSaveConversation({
          id: `conv-${Date.now()}`,
          question: userMessage.content,
          answer: assistantMessage.content,
          timestamp: new Date(),
        });
      }
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
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed z-50 w-[500px] rounded-lg border border-gray-200 bg-white shadow-xl"
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        key="contextual-chat-main-panel"
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
        style={{
          left: position.x,
          top: position.y,
          maxHeight: "600px",
        }}
        transition={{ 
          duration: 0.3, 
          ease: "easeOut",
          scale: { duration: 0.2 },
          y: { duration: 0.25 }
        }}
      >
        {/* Topic Reference - Minimal reply style (only for topic/subtopic chat) */}
        {onSaveConversation && (
          <motion.div 
            className="border-gray-200 border-b bg-gray-50/30 px-4 py-2"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <div className="flex items-center gap-2">
              <Reply className="h-3 w-3 text-gray-400 flex-shrink-0 rotate-180" />
              <div className="flex-1 min-w-0">
                <div className="text-gray-600 text-xs truncate">
                  {context.sourceTitle}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* AI Response Area - ABOVE input like Notion */}
        {(messages.length > 0 || isLoading) && (
          <div className="border-gray-200 border-b p-4">
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AIThinking 
                    message="Analyzing this section..."
                    className="px-2 py-3"
                  />
                </motion.div>
              ) : (
                messages.length > 0 && (
                  <div className="group relative">
                    <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed">
                      <StreamingText
                        text={messages.at(-1)?.content || ""}
                        isStreaming={true}
                        speed={25}
                        className="text-gray-800"
                      />
                    </div>
                    {/* Save Button - appears on hover like copy button in main chat */}
                    <div className="-right-1 absolute top-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Save to tips</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                      disabled={isLoading}
                      onClick={handleSendMessage}
                      type="button"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send message</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </motion.div>

      {/* Separate Suggestions Panel - Show previous questions for topic/subtopic OR default suggestions for regular chat */}
      {!messages.length && !isLoading && (
        (previousQuestions.length > 0) || // Show if there are previous questions (topic/subtopic)
        (previousQuestions.length === 0 && !onSaveConversation) // Show default suggestions for regular "Ask about this"
      ) && (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="fixed z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-lg"
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          key="contextual-chat-suggestions-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            left: onSaveConversation 
              ? position.x + 10 // For topic chat, align with main panel
              : position.x, // For regular chat, use click position
            top: onSaveConversation 
              ? position.y + 90 // For topic chat, position below main panel (200px height + 5px gap)
              : position.y + 60, // For regular chat, position below
          }}
          transition={{ 
            duration: 0.25, 
            delay: 0.1,
            ease: "easeOut",
            scale: { duration: 0.2, delay: 0.1 },
            y: { duration: 0.2, delay: 0.1 }
          }}
        >
          <div className="px-4 py-3">
            <div className="mb-2 font-medium text-gray-500 text-xs">
              {previousQuestions.length > 0 ? "Previous questions" : "Suggested"}
            </div>
            <div className="space-y-1">
              {/* Previous questions if available (topic/subtopic chat) */}
              {previousQuestions.length > 0 ? (
                <>
                  {previousQuestions.slice(0, 5).map((question, index) => (
                    <button
                      key={index}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-gray-700 text-sm hover:bg-gray-50"
                      onClick={() => handleQuickAction(question)}
                      type="button"
                    >
                      <MessageCircle className="h-4 w-4 text-gray-500" />
                      <span className="truncate">{question}</span>
                    </button>
                  ))}
                </>
              ) : (
                /* Default suggested actions for regular "Ask about this" */
                <>
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
                      <Brain className="h-4 w-4 text-green-500" />
                    </span>
                    Quiz me on this
                  </button>
                  <button
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-gray-700 text-sm hover:bg-gray-50"
                    onClick={() => handleQuickAction("examples")}
                    type="button"
                  >
                    <span className="flex h-4 w-4 items-center justify-center text-orange-500">
                      <Lightbulb className="h-4 w-4 text-orange-500" />
                    </span>
                    Give examples
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
