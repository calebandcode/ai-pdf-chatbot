import { useCallback, useEffect, useState } from "react";

export type SavedNote = {
  id: string;
  text: string; // The selected text
  note: string; // The note content
  rangeInfo: {
    startContainer: string; // Serialized container info
    startOffset: number;
    endContainer: string;
    endOffset: number;
    textContent: string; // Full text content for matching
    contextBefore: string; // Text before selection for disambiguation
    contextAfter: string; // Text after selection for disambiguation
  };
  position: {
    x: number;
    y: number;
  };
  timestamp: number;
  source?: string;
};

const NOTES_STORAGE_KEY = "text_notes";

export function useNotes() {
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load notes from localStorage on mount
  useEffect(() => {
    try {
      const storedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        const parsedNotes = JSON.parse(storedNotes);
        setNotes(parsedNotes);
      }
    } catch (error) {
      console.error("Error loading notes from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
      } catch (error) {
        console.error("Error saving notes to localStorage:", error);
      }
    }
  }, [notes, isLoading]);

  const addNote = useCallback(
    ({
      text,
      note,
      range,
      source,
    }: {
      text: string;
      note: string;
      range: Range;
      source?: string;
    }) => {
      // Calculate the icon position from the range (above the selected text, centered horizontally)
      const rect = range.getBoundingClientRect();
      const iconPosition = {
        x: rect.left + rect.width / 2, // Center horizontally with the text
        y: rect.top - 24, // Position icon above the text (icon height is ~20px + 4px spacing)
      };

      // Serialize a node to a string for storage
      const serializeNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (parent) {
            const children = Array.from(parent.childNodes);
            const index = children.indexOf(node as ChildNode);
            return `${parent.tagName}#${parent.className || ""}@${index}`;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const parentChildren = Array.from(
            element.parentElement?.childNodes || []
          );
          const index = parentChildren.indexOf(node as ChildNode);
          return `${element.tagName}#${element.className || ""}@${index}`;
        }
        return "";
      };

      // Get context around the selection to help identify the exact location
      const container = range.commonAncestorContainer;
      const parentElement =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as Element);
      const containerText = parentElement?.textContent || "";

      // Get text before and after the selection (for context matching)
      const startOffset = range.startOffset;
      const endOffset = range.endOffset;

      // Try to get context: 20 chars before and after
      const contextBefore = containerText.substring(
        Math.max(0, startOffset - 20),
        startOffset
      );
      const contextAfter = containerText.substring(
        Math.min(containerText.length, endOffset),
        Math.min(containerText.length, endOffset + 20)
      );

      const rangeInfo = {
        startContainer: serializeNode(range.startContainer),
        startOffset: range.startOffset,
        endContainer: serializeNode(range.endContainer),
        endOffset: range.endOffset,
        textContent: range.startContainer.parentElement?.textContent || text,
        contextBefore,
        contextAfter,
      };

      const newNote: SavedNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        text: text.trim(),
        note: note.trim(),
        rangeInfo,
        position: iconPosition, // Use calculated icon position instead of bubble position
        timestamp: Date.now(),
        source,
      };

      setNotes((prevNotes) => [newNote, ...prevNotes]);
      return newNote.id;
    },
    []
  );

  const updateNote = useCallback((id: string, note: string) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) => (n.id === id ? { ...n, note: note.trim() } : n))
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
  }, []);

  const getNoteById = useCallback(
    (id: string) => {
      return notes.find((note) => note.id === id);
    },
    [notes]
  );

  return {
    notes,
    isLoading,
    addNote,
    updateNote,
    deleteNote,
    getNoteById,
  };
}
