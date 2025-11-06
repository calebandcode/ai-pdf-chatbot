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
            {/* Floating bubble - non-blocking, no page overlay */}
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
                {/* Main content card - solid background */}
                <div className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  {/* Header */}
                  <div className="flex flex-shrink-0 items-center justify-between border-gray-200 border-b bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-sm text-gray-900">
                      {bubbleData.title}
                    </h3>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                      onClick={onClose}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Content area - quiz handles its own scrolling */}
                  {bubbleData.type === "quiz" ? (
                    <div className="flex min-h-0 flex-1 bg-white">
                      {renderContent()}
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 overflow-y-auto bg-white p-4">
                      {renderContent()}
                    </div>
                  )}
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
