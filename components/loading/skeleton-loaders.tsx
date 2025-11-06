"use client";

import { motion } from "framer-motion";

type SkeletonBlockProps = {
  lines?: number;
  className?: string;
  variant?: "text" | "card" | "list";
};

export function SkeletonBlock({
  lines = 3,
  className = "",
  variant = "text",
}: SkeletonBlockProps) {
  if (variant === "card") {
    return (
      <motion.div
        animate={{ opacity: 1 }}
        className={`space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${className}`}
        initial={{ opacity: 0 }}
      >
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              className="h-3 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
              key={i}
              style={{
                width: `${Math.random() * 40 + 60}%`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  if (variant === "list") {
    return (
      <motion.div
        animate={{ opacity: 1 }}
        className={`space-y-3 ${className}`}
        initial={{ opacity: 0 }}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            key={i}
          >
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </motion.div>
    );
  }

  // Default text variant
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className={`space-y-2 ${className}`}
      initial={{ opacity: 0 }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          className="h-4 animate-pulse rounded bg-gray-300 dark:bg-gray-600"
          key={i}
          style={{
            width: `${Math.random() * 40 + 60}%`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </motion.div>
  );
}

export function SkeletonTopic() {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      initial={{ opacity: 0 }}
    >
      {/* Topic Header */}
      <div className="space-y-2">
        <div className="h-6 w-3/4 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Subtopic List */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="flex items-center space-x-3" key={i}>
            <div className="h-2 w-2 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function SkeletonChatMessage() {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      initial={{ opacity: 0 }}
    >
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
      </div>
      <div className="ml-11 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </motion.div>
  );
}

