"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTextSelection } from "@/hooks/use-text-selection";
import { Button } from "./ui/button";

type TextSelectionBubbleProps = {
  onHighlight?: (text: string, range: Range) => void;
  onSaveTip?: (text: string, source?: string) => void;
  onQuizMe?: (text: string) => void;
  onAddNote?: (text: string) => void;
  onAskAboutThis?: (text: string, context: SelectionContext) => void;
  source?: string;
};

type SelectionContext = {
  selectedText: string;
  surroundingContext: string;
  sourceTitle: string;
  sourceType: "pdf" | "website" | "text";
  sourceId?: string;
};

export function TextSelectionBubble({
  onHighlight,
  onSaveTip,
  onQuizMe,
  onAddNote,
  onAskAboutThis,
  source,
}: TextSelectionBubbleProps) {
  const { selection, isSelecting, clearSelection } = useTextSelection();
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close bubble
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        bubbleRef.current &&
        !bubbleRef.current.contains(event.target as Node)
      ) {
        clearSelection();
      }
    };

    if (isSelecting && selection) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSelecting, selection, clearSelection]);

  // Extract surrounding context from the selection
  const extractContext = (): SelectionContext => {
    if (!selection?.range) {
      return {
        selectedText: selection?.text || "",
        surroundingContext: "",
        sourceTitle: source || "Unknown",
        sourceType: "text",
      };
    }

    // Find the paragraph or container element
    let container = selection.range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement || container;
    }

    // Try to get the paragraph or section containing the selection
    const paragraph =
      (container as Element).closest("p, div, section, article") || container;
    const surroundingText = paragraph.textContent || selection.text;

    // Determine source type based on current context
    const sourceType: "pdf" | "website" | "text" = source
      ?.toLowerCase()
      .includes("pdf")
      ? "pdf"
      : source?.toLowerCase().includes("http")
        ? "website"
        : "text";

    return {
      selectedText: selection.text,
      surroundingContext: surroundingText,
      sourceTitle: source || "Unknown Source",
      sourceType,
      sourceId: source, // We'll enhance this later with proper IDs
    };
  };

  const handleAskAboutThis = () => {
    if (!selection?.text) {
      return;
    }

    const context = extractContext();
    onAskAboutThis?.(selection.text, context);
    clearSelection();
  };

  const handleHighlight = () => {
    if (!selection?.range) {
      return;
    }

    // Create a highlight effect
    const mark = document.createElement("mark");
    mark.style.backgroundColor = "#fef08a"; // Yellow highlight
    mark.style.padding = "2px 4px";
    mark.style.borderRadius = "3px";

    try {
      selection.range.surroundContents(mark);
      onHighlight?.(selection.text, selection.range);
      toast.success("Text highlighted!");
    } catch (error) {
      console.error("Error highlighting text:", error);
      toast.error("Could not highlight text");
    }

    clearSelection();
  };

  const handlePronounce = () => {
    if (!selection?.text) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(selection.text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    speechSynthesis.speak(utterance);
    toast.success("Pronouncing text...");
    clearSelection();
  };

  const handleSaveTip = () => {
    if (!selection?.text) {
      return;
    }

    onSaveTip?.(selection.text, source);
    toast.success("Tip saved to your collection!");
    clearSelection();
  };

  const handleQuizMe = () => {
    if (!selection?.text) {
      return;
    }

    onQuizMe?.(selection.text);
    toast.success("Generating quiz questions...");
    clearSelection();
  };

  const handleAddNote = () => {
    if (!selection?.text) {
      return;
    }

    onAddNote?.(selection.text);
    toast.success("Note added!");
    clearSelection();
  };

  if (!isSelecting || !selection) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed z-50 flex items-center divide-x divide-gray-200/60 rounded-md border border-gray-200/60 bg-white/95 shadow-lg backdrop-blur-sm dark:divide-gray-700/60 dark:border-gray-700/60 dark:bg-gray-800/95"
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        ref={bubbleRef}
        style={{
          left: selection.position.x - 150, // Center the bubble (wider now with 6 buttons)
          top: selection.position.y - 60, // Position above selection
          transform: "translateX(-50%)",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Button
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-lg transition-all duration-200 hover:scale-110 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
          onClick={handleHighlight}
          size="sm"
          title="Highlight text"
          variant="ghost"
        >
          🖍️
        </Button>

        <Button
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-lg transition-all duration-200 hover:scale-110 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          onClick={handlePronounce}
          size="sm"
          title="Pronounce text"
          variant="ghost"
        >
          🔊
        </Button>

        <Button
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-lg transition-all duration-200 hover:scale-110 hover:bg-green-50 dark:hover:bg-green-900/20"
          onClick={handleSaveTip}
          size="sm"
          title="Save to tips"
          variant="ghost"
        >
          💾
        </Button>

        <Button
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-lg transition-all duration-200 hover:scale-110 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          onClick={handleQuizMe}
          size="sm"
          title="Quiz me on this"
          variant="ghost"
        >
          🧠
        </Button>

        <Button
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-lg transition-all duration-200 hover:scale-110 hover:bg-orange-50 dark:hover:bg-orange-900/20"
          onClick={handleAddNote}
          size="sm"
          title="Add note"
          variant="ghost"
        >
          📝
        </Button>

        <Button
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-lg transition-all duration-200 hover:scale-110 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          onClick={handleAskAboutThis}
          size="sm"
          title="Ask about this"
          variant="ghost"
        >
          💬
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
