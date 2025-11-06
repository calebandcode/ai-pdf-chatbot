"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Copy,
  Highlighter,
  MessageCircle,
  StickyNote,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTextSelection } from "@/hooks/use-text-selection";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type TextSelectionBubbleProps = {
  onHighlight?: (text: string, range: Range) => void;
  onQuizMe?: (text: string) => void;
  onAddNote?: (
    text: string,
    range: Range,
    position: { x: number; y: number }
  ) => void;
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
  onQuizMe,
  onAddNote,
  onAskAboutThis,
  source,
}: TextSelectionBubbleProps) {
  const { selection, isSelecting, clearSelection } = useTextSelection();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#fef08a"); // Default yellow
  const [hasHighlight, setHasHighlight] = useState(false);

  const highlightColors = [
    { name: "Yellow", value: "#fef08a", bg: "bg-yellow-200" },
    { name: "Green", value: "#bbf7d0", bg: "bg-green-200" },
    { name: "Blue", value: "#bfdbfe", bg: "bg-blue-200" },
    { name: "Pink", value: "#fce7f3", bg: "bg-pink-200" },
    { name: "Purple", value: "#e9d5ff", bg: "bg-purple-200" },
    { name: "Orange", value: "#fed7aa", bg: "bg-orange-200" },
  ];

  // Handle click outside to close bubble
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        bubbleRef.current &&
        !bubbleRef.current.contains(event.target as Node)
      ) {
        setShowColorPicker(false);
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

  // Check if current selection has a highlight
  const checkForHighlight = useCallback(() => {
    if (!selection?.range) {
      setHasHighlight(false);
      return;
    }

    try {
      const range = selection.range.cloneRange();
      const container = range.commonAncestorContainer;

      // Find the closest mark element
      let current: Element | null =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as Element);

      while (current && current !== document.body) {
        if (current.tagName === "MARK") {
          setHasHighlight(true);
          return;
        }
        current = current.parentElement;
      }

      setHasHighlight(false);
    } catch {
      setHasHighlight(false);
    }
  }, [selection?.range]);

  // Close color picker when selection changes and check for highlights
  useEffect(() => {
    if (isSelecting) {
      checkForHighlight();
    } else {
      setShowColorPicker(false);
    }
  }, [isSelecting, checkForHighlight]);

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

  const handleHighlight = (color: string) => {
    if (!selection?.range) {
      return;
    }

    // Create a highlight effect
    const mark = document.createElement("mark");
    mark.style.backgroundColor = color;
    mark.style.padding = "2px 4px";
    mark.style.borderRadius = "3px";

    try {
      // Clone the range to avoid issues with selection clearing
      const range = selection.range.cloneRange();
      range.surroundContents(mark);
      onHighlight?.(selection.text, range);
      setHasHighlight(true);
      toast.success("Text highlighted!");
    } catch (error) {
      console.error("Error highlighting text:", error);
      toast.error("Could not highlight text");
    }

    setShowColorPicker(false);
    clearSelection();
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    handleHighlight(color);
  };

  const handleClearHighlight = () => {
    if (!selection?.range) {
      return;
    }

    try {
      // Get the range and check if it's within a mark element
      const range = selection.range.cloneRange();
      const container = range.commonAncestorContainer;

      // Find the closest mark element
      let markElement: Element | null = null;
      let current: Element | null =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as Element);

      while (current && current !== document.body) {
        if (current.tagName === "MARK") {
          markElement = current;
          break;
        }
        current = current.parentElement;
      }

      if (markElement) {
        // Replace the mark with its text content
        const parent = markElement.parentNode;
        if (parent) {
          const textContent = markElement.textContent || "";
          const textNode = document.createTextNode(textContent);
          parent.replaceChild(textNode, markElement);
          setHasHighlight(false);
          toast.success("Highlight cleared!");
        } else {
          toast.error("Could not clear highlight");
        }
      } else {
        toast.error("No highlight found to clear");
      }
    } catch (error) {
      console.error("Error clearing highlight:", error);
      toast.error("Could not clear highlight");
    }

    setShowColorPicker(false);
    clearSelection();
  };

  const handleHighlightButtonClick = () => {
    if (showColorPicker) {
      // If color picker is open, close it
      setShowColorPicker(false);
    } else {
      // Show color picker
      setShowColorPicker(true);
    }
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

  const handleQuizMe = () => {
    if (!selection?.text) {
      return;
    }

    onQuizMe?.(selection.text);
    toast.success("Generating quiz questions...");
    clearSelection();
  };

  const handleAddNote = () => {
    if (!selection?.text || !selection?.range) {
      return;
    }

    if (onAddNote) {
      onAddNote(selection.text, selection.range, selection.position);
    } else {
      console.error(
        "onAddNote is not defined! Note functionality not available."
      );
    }
    // Don't clear selection here - let the note bubble handle it
  };

  const handleCopy = async () => {
    if (!selection?.text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selection.text);
      toast.success("Text copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy text");
    }

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
          left: selection.position.x - 175, // Center the bubble (wider now with 7 buttons)
          top: selection.position.y - 60, // Position above selection
          transform: "translateX(-50%)",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={`h-10 w-10 rounded-lg border-0 bg-transparent p-0 transition-all duration-200 hover:scale-110 ${
                  showColorPicker
                    ? "bg-yellow-100 dark:bg-yellow-900/30"
                    : "hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                }`}
                onClick={handleHighlightButtonClick}
                size="sm"
                variant="ghost"
              >
                <Highlighter className="h-5 w-5 text-yellow-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Highlight text</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 transition-all duration-200 hover:scale-110 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={handlePronounce}
                size="sm"
                variant="ghost"
              >
                <Volume2 className="h-5 w-5 text-blue-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pronounce text</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 transition-all duration-200 hover:scale-110 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                onClick={handleQuizMe}
                size="sm"
                variant="ghost"
              >
                <Brain className="h-5 w-5 text-purple-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Quiz me on this</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 transition-all duration-200 hover:scale-110 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                onClick={handleAddNote}
                size="sm"
                variant="ghost"
              >
                <StickyNote className="h-5 w-5 text-orange-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add note</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 transition-all duration-200 hover:scale-110 hover:bg-gray-50 dark:hover:bg-gray-900/20"
                onClick={handleCopy}
                size="sm"
                variant="ghost"
              >
                <Copy className="h-5 w-5 text-gray-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy text</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 transition-all duration-200 hover:scale-110 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                onClick={handleAskAboutThis}
                size="sm"
                variant="ghost"
              >
                <MessageCircle className="h-5 w-5 text-indigo-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ask about this</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Color Picker Dropdown - positioned relative to the main bubble */}
        <AnimatePresence>
          {showColorPicker && (
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="-translate-x-1/2 absolute bottom-full left-1/2 mb-2 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ zIndex: 1000 }}
            >
              <div className="mb-1 font-medium text-gray-600 text-xs">
                Choose color:
              </div>
              <div className="grid grid-cols-3 gap-1">
                {highlightColors.map((color) => (
                  <button
                    className={`h-6 w-6 rounded border-2 transition-all hover:scale-110 ${
                      selectedColor === color.value
                        ? "border-gray-400 ring-2 ring-gray-300"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    key={color.value}
                    onClick={() => handleColorSelect(color.value)}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    type="button"
                  />
                ))}
              </div>
              {hasHighlight && (
                <div className="mt-1 flex justify-center">
                  <button
                    className="flex items-center gap-1 rounded px-2 py-1 text-gray-600 text-xs transition-colors hover:bg-gray-100 hover:text-gray-800"
                    onClick={handleClearHighlight}
                    title="Clear highlight"
                    type="button"
                  >
                    <span>Clear highlight</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
