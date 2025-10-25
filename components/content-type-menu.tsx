"use client";

import { createPortal } from "react-dom";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, Link, Youtube, Upload } from "lucide-react";

export type ContentType = "pdf" | "link" | "youtube" | "text";

interface ContentTypeMenuProps {
  onContentTypeSelect: (type: ContentType) => void;
  disabled?: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

export function ContentTypeMenu({ 
  onContentTypeSelect, 
  disabled = false,
  fileInputRef 
}: ContentTypeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const menuHeight = 200; // Approximate menu height
      
      // Position above the button, but ensure it's visible
      let top = buttonRect.top - menuHeight - 10;
      
      // If it would go off-screen, position it below instead
      if (top < 10) {
        top = buttonRect.bottom + 10;
      }
      
      setMenuPosition({
        top: Math.max(10, top),
        left: buttonRect.left,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (type: ContentType) => {
    if (type === "pdf") {
      // Trigger file input for PDF
      fileInputRef.current?.click();
    } else {
      onContentTypeSelect(type);
    }
    setIsOpen(false);
  };

  const menuItems = [
    {
      type: "pdf" as ContentType,
      label: "PDF Document",
      icon: Upload,
      description: "Upload a PDF file",
    },
    {
      type: "link" as ContentType,
      label: "Website Link",
      icon: Link,
      description: "Analyze a webpage",
    },
    {
      type: "youtube" as ContentType,
      label: "YouTube Video",
      icon: Youtube,
      description: "Get video transcript",
    },
    {
      type: "text" as ContentType,
      label: "Plain Text",
      icon: FileText,
      description: "Enter text content",
    },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent disabled:opacity-50"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <Plus size={14} style={{ width: 14, height: 14 }} />
      </button>

      {isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg z-[9999]"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100"
                  onClick={() => handleSelect(item.type)}
                  type="button"
                >
                  <Icon className="h-4 w-4 text-gray-600" />
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{item.label}</span>
                    <span className="text-xs text-gray-500">{item.description}</span>
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}