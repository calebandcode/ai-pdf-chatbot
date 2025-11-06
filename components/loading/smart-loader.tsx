"use client";

import { motion } from "framer-motion";
import { Brain, Loader2, Sparkles } from "lucide-react";

type SmartLoaderProps = {
  message: string;
  type?: "default" | "ai" | "analysis";
  showProgress?: boolean;
  progress?: number;
};

const loaderVariants = {
  default: {
    icon: Loader2,
    className: "text-indigo-600",
    size: "w-10 h-10",
  },
  ai: {
    icon: Brain,
    className: "text-purple-600",
    size: "w-12 h-12",
  },
  analysis: {
    icon: Sparkles,
    className: "text-blue-600",
    size: "w-10 h-10",
  },
};

export function SmartLoader({
  message,
  type = "default",
  showProgress = false,
  progress = 0,
}: SmartLoaderProps) {
  const config = loaderVariants[type];
  const Icon = config.icon;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed bottom-6 right-6 z-50 rounded-lg border border-gray-200/50 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/95"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
    >
      <div className="flex flex-col items-center space-y-3">
        {/* Animated Icon */}
        <motion.div
          animate={{
            rotate: type === "ai" ? [0, 10, -10, 0] : 360,
            scale: type === "ai" ? [1, 1.1, 1] : 1,
          }}
          className="relative"
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: type === "ai" ? 2 : 1,
            ease: type === "ai" ? "easeInOut" : "linear",
          }}
        >
          <Icon className={`${config.size} ${config.className}`} />

          {/* AI Thinking Dots */}
          {type === "ai" && (
            <div className="-bottom-2 -right-2 absolute flex space-x-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  className="h-2 w-2 rounded-full bg-purple-400"
                  key={i}
                  transition={{
                    repeat: Number.POSITIVE_INFINITY,
                    duration: 1.5,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Message */}
        <motion.p
          animate={{ opacity: [0.7, 1, 0.7] }}
          className="text-center font-medium text-gray-700 text-sm dark:text-gray-200"
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
        >
          {message}
        </motion.p>

        {/* Progress Bar */}
        {showProgress && (
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <motion.div
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              initial={{ width: 0 }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
        )}

        {/* AI Personality Messages */}
        {type === "ai" && (
          <motion.p
            animate={{ opacity: [0, 1, 0] }}
            className="text-gray-500 text-xs italic dark:text-gray-400"
            transition={{
              repeat: Number.POSITIVE_INFINITY,
              duration: 3,
              delay: 1,
            }}
          >
            {getRandomAIMessage()}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

function getRandomAIMessage() {
  const messages = [
    "Good things take time... 😊",
    "Almost there, I promise! ✨",
    "Working my magic... 🪄",
    "This is going to be worth it! 🚀",
    "Just a few more seconds... ⏰",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
