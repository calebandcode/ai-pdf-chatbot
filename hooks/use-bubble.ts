"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BubbleContentType = "quiz" | "learn-more" | "save";

export type BubbleData = {
  type: BubbleContentType;
  title: string;
  content: any; // Will be typed based on content type
  sourceElement?: HTMLElement;
};

export type BubblePosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function useBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [bubbleData, setBubbleData] = useState<BubbleData | null>(null);
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback((sourceElement: HTMLElement, bubbleType?: BubbleContentType) => {
    const rect = sourceElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Default bubble dimensions - make it taller for quiz content
    const bubbleWidth = 450;
    const bubbleHeight = Math.min(600, viewport.height - 100); // Max 600px, but leave 100px margin

    // Calculate optimal position
    let x = rect.left + rect.width / 2 - bubbleWidth / 2;

    // FOR QUIZ BUBBLES: Force to upper portion, NEVER at bottom
    if (bubbleType === "quiz") {
      // Always position quiz bubbles in the upper portion of viewport
      const y = Math.max(80, Math.min(100, viewport.height * 0.1)); // Top 10% of viewport, max 100px from top
      
      // Adjust for viewport boundaries
      if (x < 20) {
        x = 20;
      }
      if (x + bubbleWidth > viewport.width - 20) {
        x = viewport.width - bubbleWidth - 20;
      }

      return {
        x: Math.max(20, Math.min(x, viewport.width - bubbleWidth - 20)),
        y: Math.max(80, Math.min(y, 120)), // Keep it high, between 80-120px from top
        width: bubbleWidth,
        height: bubbleHeight,
      };
    }

    // For other bubble types, use original logic
    let y = rect.bottom + 10; // Default: 10px gap below element

    // Check if we can position above the element
    if (rect.top - bubbleHeight - 10 > 80) {
      y = rect.top - bubbleHeight - 10;
    } else if (rect.bottom + bubbleHeight > viewport.height - 80) {
      y = Math.max(80, viewport.height - bubbleHeight - 20);
    }

    // Adjust for viewport boundaries
    if (x < 20) {
      x = 20;
    }
    if (x + bubbleWidth > viewport.width - 20) {
      x = viewport.width - bubbleWidth - 20;
    }

    // Final boundary check
    if (y + bubbleHeight > viewport.height - 20) {
      y = Math.max(80, viewport.height - bubbleHeight - 20);
    }

    return {
      x: Math.max(20, Math.min(x, viewport.width - bubbleWidth - 20)),
      y: Math.max(80, Math.min(y, viewport.height - bubbleHeight - 20)),
      width: bubbleWidth,
      height: bubbleHeight,
    };
  }, []);

  const openBubble = useCallback(
    (data: BubbleData) => {
      if (data.sourceElement) {
        const newPosition = calculatePosition(data.sourceElement, data.type);
        setPosition(newPosition);
      }
      setBubbleData(data);
      setIsOpen(true);
    },
    [calculatePosition]
  );

  const closeBubble = useCallback(() => {
    setIsOpen(false);
    setBubbleData(null);
    setPosition(null);
  }, []);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        bubbleRef.current &&
        !bubbleRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest("[data-bubble-trigger]")
      ) {
        closeBubble();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeBubble();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, closeBubble]);

  return {
    isOpen,
    bubbleData,
    position,
    bubbleRef,
    openBubble,
    closeBubble,
  };
}
