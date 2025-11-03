"use client";

import { useEffect, useRef, useState } from "react";
import { useFont } from "@/contexts/font-context";

export function MagnifyingGlass() {
  const { isMagnifierActive } = useFont();
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [content, setContent] = useState("");
  const magnifierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMagnifierActive) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });

      // Get element under cursor
      const elementUnderCursor = document.elementFromPoint(
        e.clientX,
        e.clientY
      );

      if (elementUnderCursor) {
        // Get text content from the element and its siblings
        let text = "";
        const walker = document.createTreeWalker(
          elementUnderCursor,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node;
        while ((node = walker.nextNode())) {
          const textContent = node.textContent?.trim();
          if (textContent && textContent.length > 0) {
            text += textContent + " ";
          }
        }

        // If no text found, try parent element
        if (!text && elementUnderCursor.parentElement) {
          const parentText = elementUnderCursor.parentElement.textContent;
          if (parentText) {
            text = parentText.slice(0, 200); // Limit to 200 chars
          }
        }

        setContent(text.slice(0, 100)); // Show first 100 chars
      }
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isMagnifierActive]);

  if (!isMagnifierActive) {
    return null;
  }

  const size = 120;
  const offset = size / 2;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-full border-2 border-indigo-500 bg-white shadow-2xl"
      ref={magnifierRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        left: `${cursorPos.x - offset}px`,
        top: `${cursorPos.y - offset}px`,
        transform: "scale(1.8)",
        transformOrigin: "center",
      }}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full p-3"
        style={{
          transform: `translate(${-cursorPos.x / 1.8 + offset}px, ${
            -cursorPos.y / 1.8 + offset
          }px)`,
          fontSize: "10px",
        }}
      >
        {content || (
          <div className="text-gray-400 text-xs">Hover over text</div>
        )}
      </div>
    </div>
  );
}




