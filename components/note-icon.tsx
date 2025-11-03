"use client";

import { motion } from "framer-motion";
import { StickyNote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SavedNote } from "@/hooks/use-notes";

type NoteIconProps = {
  note: SavedNote;
  onOpen: (note: SavedNote) => void;
};

export function NoteIcon({ note, onOpen }: NoteIconProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Find the position where this note should be displayed
    const findNotePosition = () => {
      let foundPosition: { x: number; y: number } | null = null;

      // Normalize the note text for searching (remove extra whitespace)
      const noteText = note.text.trim();

      // Use context to identify the exact occurrence
      const contextBefore = note.rangeInfo.contextBefore || "";
      const contextAfter = note.rangeInfo.contextAfter || "";

      // Try to find the text by searching through all text content
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node = walker.nextNode();
      const candidates: Array<{
        node: Node;
        startIndex: number;
        endIndex: number;
        surroundingText: string;
      }> = [];

      while (node) {
        const textContent = node.textContent || "";

        // Look for the note text in this node
        let searchIndex = 0;
        while (true) {
          const index = textContent.indexOf(noteText, searchIndex);
          if (index === -1) {
            break;
          }

          // Found a candidate - get surrounding text for context matching
          const startIndex = index;
          const endIndex = Math.min(
            startIndex + noteText.length,
            textContent.length
          );

          // Get text around this match for context verification
          const beforeStart = Math.max(0, startIndex - 20);
          const afterEnd = Math.min(textContent.length, endIndex + 20);
          const surroundingText = textContent.substring(beforeStart, afterEnd);

          candidates.push({
            node,
            startIndex,
            endIndex,
            surroundingText,
          });

          searchIndex = index + 1;
        }

        node = walker.nextNode();
      }

      // Score each candidate based on context match
      let bestCandidate: (typeof candidates)[0] | null = null;
      let bestScore = -1;

      for (const candidate of candidates) {
        try {
          const range = document.createRange();
          range.setStart(candidate.node, candidate.startIndex);
          range.setEnd(candidate.node, candidate.endIndex);

          const rect = range.getBoundingClientRect();

          // Verify the range matches the note text
          const rangeText = range.toString().trim().replace(/\s+/g, " ");
          const noteTextNormalized = noteText.replace(/\s+/g, " ");

          if (
            rect.width > 0 &&
            rect.height > 0 &&
            rangeText === noteTextNormalized
          ) {
            // Score based on context matching
            let score = 0;
            const normalizedSurrounding = candidate.surroundingText
              .toLowerCase()
              .replace(/\s+/g, " ");
            const normalizedContextBefore = contextBefore
              .toLowerCase()
              .replace(/\s+/g, " ");
            const normalizedContextAfter = contextAfter
              .toLowerCase()
              .replace(/\s+/g, " ");

            // Check if context before matches
            if (
              normalizedContextBefore &&
              normalizedSurrounding.includes(normalizedContextBefore)
            ) {
              score += 2;
            }

            // Check if context after matches
            if (
              normalizedContextAfter &&
              normalizedSurrounding.includes(normalizedContextAfter)
            ) {
              score += 2;
            }

            // Prefer candidates that match both contexts
            if (score > bestScore) {
              bestScore = score;
              bestCandidate = candidate;
            }
          }
        } catch {
          // Continue to next candidate
        }
      }

      // Use the best candidate, or fall back to first if no context match
      const candidateToUse =
        bestCandidate ||
        candidates.find((c) => {
          try {
            const range = document.createRange();
            range.setStart(c.node, c.startIndex);
            range.setEnd(c.node, c.endIndex);
            const rect = range.getBoundingClientRect();
            const rangeText = range.toString().trim().replace(/\s+/g, " ");
            const noteTextNormalized = noteText.replace(/\s+/g, " ");
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              rangeText === noteTextNormalized
            );
          } catch {
            return false;
          }
        });

      if (candidateToUse) {
        try {
          const range = document.createRange();
          range.setStart(candidateToUse.node, candidateToUse.startIndex);
          range.setEnd(candidateToUse.node, candidateToUse.endIndex);
          const rect = range.getBoundingClientRect();

          if (rect.width > 0 && rect.height > 0) {
            foundPosition = {
              x: rect.left + rect.width / 2,
              y: rect.top - 24, // Icon height (~20px) + spacing (4px)
            };
          }
        } catch {
          // Continue to fallback
        }
      }

      // If no exact match, try searching parent elements
      if (!foundPosition) {
        const allElements = document.querySelectorAll(
          "p, div, span, li, td, th, h1, h2, h3, h4, h5, h6"
        );

        for (const element of Array.from(allElements)) {
          const elementText = element.textContent || "";

          if (elementText.includes(noteText)) {
            try {
              // Try to find the text within this element
              const walker2 = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null
              );

              let textNode = walker2.nextNode();
              while (textNode && !foundPosition) {
                const textContent = textNode.textContent || "";
                const index = textContent.indexOf(noteText);

                if (index !== -1) {
                  try {
                    const range = document.createRange();
                    range.setStart(textNode, index);
                    range.setEnd(
                      textNode,
                      Math.min(index + noteText.length, textContent.length)
                    );

                    const rect = range.getBoundingClientRect();

                    if (rect.width > 0 && rect.height > 0) {
                      foundPosition = {
                        x: rect.left + rect.width / 2,
                        y: rect.top - 24, // Icon height (~20px) + spacing (4px)
                      };
                      break;
                    }
                  } catch {
                    // Continue searching
                  }
                }

                textNode = walker2.nextNode();
              }

              if (foundPosition) {
                break;
              }
            } catch {
              // Continue to next element
            }
          }
        }
      }

      // Last resort: use stored position (might be incorrect but better than nothing)
      if (!foundPosition) {
        foundPosition = {
          x: note.position.x,
          y: note.position.y,
        };
      }

      setPosition(foundPosition);
    };

    findNotePosition();

    // Recalculate position on scroll/resize
    const handleResize = () => findNotePosition();
    const handleScroll = () => findNotePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [note]);

  if (!position) {
    return null;
  }

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="fixed z-40 cursor-pointer"
      initial={{ opacity: 0, scale: 0.8 }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(note);
      }}
      ref={iconRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)", // Center horizontally
      }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="flex items-center justify-center rounded-full bg-yellow-400 p-1.5 shadow-md transition-shadow hover:shadow-lg">
        <StickyNote className="h-3 w-3 text-yellow-900" />
      </div>
    </motion.div>
  );
}
