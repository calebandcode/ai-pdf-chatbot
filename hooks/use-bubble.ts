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

  const calculatePosition = useCallback((sourceElement: HTMLElement) => {
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
    let y = rect.bottom + 10; // 10px gap below element

    // Adjust for viewport boundaries
    if (x < 20) {
      x = 20;
    }
    if (x + bubbleWidth > viewport.width - 20) {
      x = viewport.width - bubbleWidth - 20;
    }

    // If not enough space below, position above
    if (y + bubbleHeight > viewport.height - 20) {
      y = rect.top - bubbleHeight - 10;
    }

    // If still not enough space, center vertically
    if (y < 20) {
      y = Math.max(20, (viewport.height - bubbleHeight) / 2);
    }

    return {
      x: Math.max(20, Math.min(x, viewport.width - bubbleWidth - 20)),
      y: Math.max(20, Math.min(y, viewport.height - bubbleHeight - 20)),
      width: bubbleWidth,
      height: bubbleHeight,
    };
  }, []);

  const openBubble = useCallback(
    (data: BubbleData) => {
      if (data.sourceElement) {
        const newPosition = calculatePosition(data.sourceElement);
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
