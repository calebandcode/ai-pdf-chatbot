"use client";

import { motion } from "framer-motion";

interface TypingIndicatorProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  color?: "gray" | "blue" | "purple";
}

export function TypingIndicator({ 
  className = "", 
  size = "md",
  color = "gray" 
}: TypingIndicatorProps) {
  const sizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2", 
    lg: "w-3 h-3"
  };

  const colorClasses = {
    gray: "bg-gray-400 dark:bg-gray-500",
    blue: "bg-blue-400 dark:bg-blue-500",
    purple: "bg-purple-400 dark:bg-purple-500"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={`flex space-x-1 items-center justify-start ${className}`}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 1.2,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
        />
      ))}
    </motion.div>
  );
}

interface AIThinkingProps {
  message?: string;
  className?: string;
}

export function AIThinking({ 
  message = "AI is thinking...", 
  className = "" 
}: AIThinkingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ${className}`}
    >
      <TypingIndicator size="sm" color="blue" />
      <span className="font-medium">{message}</span>
    </motion.div>
  );
}


