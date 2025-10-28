import { useCallback, useEffect, useState } from "react";

export type TextSelection = {
  text: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  range: Range | null;
};

export function useTextSelection() {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelection = useCallback(() => {
    const windowSelection = window.getSelection();

    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null);
      setIsSelecting(false);
      return;
    }

    const selectedText = windowSelection.toString().trim();

    if (selectedText.length === 0) {
      setSelection(null);
      setIsSelecting(false);
      return;
    }

    const range = windowSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Only show bubble for selections longer than 3 characters
    if (selectedText.length < 3) {
      setSelection(null);
      setIsSelecting(false);
      return;
    }

    setSelection({
      text: selectedText,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        width: rect.width,
        height: rect.height,
      },
      range,
    });
    setIsSelecting(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsSelecting(false);
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      handleSelection();
    };

    // Only clear selection on escape key or when clicking far from the selection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keyup", handleSelection);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keyup", handleSelection);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSelection, clearSelection]);

  return {
    selection,
    isSelecting,
    clearSelection,
  };
}
