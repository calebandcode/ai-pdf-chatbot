"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "./ui/textarea";

type NoteBubbleProps = {
  text: string;
  initialNote?: string;
  position: { x: number; y: number };
  onSave: (note: string) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function NoteBubble({
  text,
  initialNote = "",
  position,
  onSave,
  onDelete,
  onClose,
}: NoteBubbleProps) {
  const [note, setNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        bubbleRef.current &&
        !bubbleRef.current.contains(event.target as Node) &&
        !note.trim()
      ) {
        // Only auto-close if note is empty, otherwise require explicit close
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [note, onClose]);

  const handleSave = () => {
    if (note.trim()) {
      setIsSaving(true);
      onSave(note.trim());
      setIsSaving(false);
      onClose();
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed z-[60] w-80 rounded-lg border border-yellow-200 bg-yellow-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        ref={bubbleRef}
        style={{
          left: Math.max(
            20,
            Math.min(position.x - 160, window.innerWidth - 340)
          ),
          top: Math.max(
            80,
            Math.min(position.y - 10, window.innerHeight - 300)
          ),
        }}
        transition={{
          duration: 0.25,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        {/* Header with selected text as title */}
        <div className="flex items-center justify-between border-yellow-200 border-b bg-yellow-50 px-3 py-2">
          <p className="line-clamp-1 flex-1 pr-2 font-medium text-gray-900 text-sm">
            {text.length > 50 ? `${text.substring(0, 50)}...` : text}
          </p>
          <button
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-yellow-700 transition-colors hover:bg-yellow-100 hover:text-yellow-900"
            onClick={onClose}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Note textarea */}
        <div className="p-3">
          <Textarea
            autoFocus
            className="min-h-[120px] resize-none border-0 bg-transparent text-gray-900 text-sm focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your note here..."
            value={note}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-yellow-200 border-t bg-yellow-50 px-3 py-2">
          {onDelete && initialNote && (
            <button
              className="flex h-7 items-center gap-1 rounded px-2 text-xs text-yellow-700 transition-colors hover:bg-yellow-100 hover:text-yellow-900"
              onClick={handleDelete}
              type="button"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </button>
          )}
          <button
            className="ml-auto flex h-7 w-7 items-center justify-center rounded bg-yellow-500 text-yellow-900 transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:bg-yellow-200 disabled:text-yellow-400"
            disabled={!note.trim() || isSaving}
            onClick={handleSave}
            type="button"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
