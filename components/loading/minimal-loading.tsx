"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";

type MinimalLoadingProps = {
  message?: string;
  variant?: "chat" | "analysis" | "processing";
  showIcon?: boolean;
  className?: string;
};

const loadingMessages = {
  chat: [
    "Thinking...",
    "Analyzing...",
    "Processing...",
    "Almost ready...",
  ],
  analysis: [
    "Reading...",
    "Understanding...",
    "Processing...",
    "Preparing...",
  ],
  processing: [
    "Learning...",
    "Processing...",
    "Extracting...",
    "Building...",
  ],
};

export function MinimalLoading({ 
  message, 
  variant = "chat", 
  showIcon = true,
  className = ""
}: MinimalLoadingProps) {
  const Icon = variant === "analysis" ? Sparkles : Brain;
  const iconColor = variant === "analysis" ? "text-blue-500" : "text-purple-500";
  
  const defaultMessage = message || loadingMessages[variant][0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={`flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 ${className}`}
    >
      {showIcon && (
        <motion.div
          animate={{ 
            rotate: [0, 10, -10, 0],
            scale: [1, 1.05, 1]
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 2, 
            ease: "easeInOut" 
          }}
        >
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </motion.div>
      )}
      
      <div className="flex items-center space-x-1">
        <span className="italic">{defaultMessage}</span>
        
        {/* Simple typing dots */}
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1 w-1 bg-gray-400 dark:bg-gray-500 rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                repeat: Infinity,
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

// Inline loading for buttons and small spaces
export function InlineLoading({ 
  message = "Loading...", 
  size = "sm" 
}: { 
  message?: string; 
  size?: "sm" | "md" 
}) {
  const sizeClasses = size === "sm" ? "text-xs" : "text-sm";
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center space-x-2 text-gray-500 ${sizeClasses}`}
    >
      <motion.div
        className="h-3 w-3 border-2 border-gray-300 border-t-gray-600 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      />
      <span>{message}</span>
    </motion.div>
  );
}

// Subtle progress indicator
export function ProgressIndicator({ 
  progress, 
  message 
}: { 
  progress: number; 
  message?: string 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400"
    >
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-1 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: "easeOut", duration: 0.3 }}
        />
      </div>
      {message && <span className="text-xs">{message}</span>}
    </motion.div>
  );
}


