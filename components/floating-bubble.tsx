"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { forwardRef } from "react";
import type { BubbleData, BubblePosition } from "@/hooks/use-bubble";
import { LearnMoreBubble } from "./learn-more-bubble";
import { QuizBubble } from "./quiz-bubble";
import { SaveBubble } from "./save-bubble";

type FloatingBubbleProps = {
  isOpen: boolean;
  bubbleData: BubbleData | null;
  position: BubblePosition | null;
  onClose: () => void;
};

export const FloatingBubble = forwardRef<HTMLDivElement, FloatingBubbleProps>(
  ({ isOpen, bubbleData, position, onClose }, ref) => {
    if (!isOpen || !bubbleData || !position) {
      return null;
    }

    const renderContent = () => {
      switch (bubbleData.type) {
        case "quiz":
          return <QuizBubble data={bubbleData.content} onClose={onClose} />;
        case "learn-more":
          return (
            <LearnMoreBubble data={bubbleData.content} onClose={onClose} />
          );
        case "save":
          return <SaveBubble data={bubbleData.content} onClose={onClose} />;
        default:
          return null;
      }
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Background blur overlay - only for the specific section */}
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={onClose}
              transition={{ duration: 0.2 }}
            />

            {/* Floating bubble */}
            <motion.div
              animate={{
                opacity: 1,
                scale: 1,
                y: position.y,
              }}
              className="pointer-events-auto"
              exit={{
                opacity: 0,
                scale: 0.8,
                y: position.y + 20,
              }}
              initial={{
                opacity: 0,
                scale: 0.8,
                y: position.y + 20,
              }}
              ref={ref}
              style={{
                position: "fixed",
                left: position.x,
                top: position.y,
                width: position.width,
                height: position.height,
                zIndex: 50,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                duration: 0.3,
              }}
            >
              {/* Bubble container */}
              <div className="relative h-full w-full">
                {/* Main content card */}
                <div className="relative h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between border-gray-100 border-b bg-gray-50/50 px-4 py-3">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      {bubbleData.title}
                    </h3>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
                      onClick={onClose}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Content area */}
                  <div className="h-full overflow-y-auto p-4">
                    {renderContent()}
                  </div>
                </div>

                {/* Subtle arrow pointing to source element */}
                <div className="-top-2 -translate-x-1/2 absolute left-1/2 h-4 w-4 rotate-45 border-gray-200 border-t border-l bg-white" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

FloatingBubble.displayName = "FloatingBubble";
