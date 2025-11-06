"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type AIThinkingProps = {
  message?: string;
  variant?: "chat" | "analysis" | "processing";
  showIcon?: boolean;
};

const thinkingMessages = {
  chat: [
    "Thinking deeply...",
    "Analyzing your question...",
    "Gathering context...",
    "Forming an answer...",
    "Almost ready...",
  ],
  analysis: [
    "Reading that section...",
    "Understanding the context...",
    "Processing the information...",
    "Making connections...",
    "Preparing insights...",
  ],
  processing: [
    "Learning from your input...",
    "Processing the content...",
    "Extracting key insights...",
    "Building understanding...",
    "Almost done...",
  ],
};

export function AIThinking({
  message,
  variant = "chat",
  showIcon = true,
}: AIThinkingProps) {
  const [currentMessage, setCurrentMessage] = useState(message || "");
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (message) return; // Don't cycle if message is provided

    const messages = thinkingMessages[variant];
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [message, variant]);

  useEffect(() => {
    if (message) return;

    const messages = thinkingMessages[variant];
    setCurrentMessage(messages[messageIndex]);
  }, [messageIndex, message, variant]);

  const Icon = variant === "analysis" ? Sparkles : Brain;
  const iconColor =
    variant === "analysis" ? "text-blue-500" : "text-purple-500";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center space-x-3 px-4 py-3 text-gray-600 text-sm dark:text-gray-300"
      exit={{ opacity: 0, y: -10 }}
      initial={{ opacity: 0, y: 10 }}
    >
      {showIcon && (
        <motion.div
          animate={{
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 2,
            ease: "easeInOut",
          }}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </motion.div>
      )}

      <div className="flex items-center space-x-2">
        <span className="italic">{currentMessage}</span>

        {/* Typing Dots */}
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500"
              key={i}
              transition={{
                repeat: Number.POSITIVE_INFINITY,
                duration: 1.5,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

