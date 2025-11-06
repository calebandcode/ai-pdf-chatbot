"use client";

import type React from "react";
import { createContext, useContext, useState } from "react";
import type { SavedNote } from "@/hooks/use-notes";
import { useNotes } from "@/hooks/use-notes";
import { NoteBubble } from "./note-bubble";
import { NoteIcon } from "./note-icon";

type NoteManagerContextType = {
  requestNote: (
    text: string,
    range: Range,
    position: { x: number; y: number }
  ) => void;
};

const NoteManagerContext = createContext<NoteManagerContextType | null>(null);

export function useNoteManager() {
  const context = useContext(NoteManagerContext);
  if (!context) {
    throw new Error("useNoteManager must be used within NoteManager");
  }
  return context;
}

type NoteManagerProps = {
  source?: string;
  children?: (
    requestNote: (
      text: string,
      range: Range,
      position: { x: number; y: number }
    ) => void
  ) => React.ReactNode;
};

export function NoteManager({ source, children }: NoteManagerProps) {
  const { notes, addNote, updateNote, deleteNote } = useNotes();
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState<{
    text: string;
    range: Range;
    position: { x: number; y: number };
  } | null>(null);

  // Filter notes for current source if provided
  const relevantNotes = source
    ? notes.filter((note) => note.source === source)
    : notes;

  const handleOpenNote = (note: SavedNote) => {
    setOpenNoteId(note.id);
    setPendingNote(null);
  };

  const handleCloseNote = () => {
    setOpenNoteId(null);
    setPendingNote(null);
  };

  const handleSaveNote = (noteText: string) => {
    if (openNoteId) {
      // Update existing note
      updateNote(openNoteId, noteText);
    } else if (pendingNote) {
      // Create new note
      addNote({
        text: pendingNote.text,
        note: noteText,
        range: pendingNote.range,
        source,
      });
      setPendingNote(null);
    }
  };

  const handleDeleteNote = () => {
    if (openNoteId) {
      deleteNote(openNoteId);
      setOpenNoteId(null);
    }
  };

  const requestNote = (
    text: string,
    range: Range,
    position: { x: number; y: number }
  ) => {
    console.log("requestNote called with:", { text, range, position });
    setPendingNote({ text, range, position });
    setOpenNoteId(null); // Close any existing note
  };

  const openNote = openNoteId ? notes.find((n) => n.id === openNoteId) : null;

  const pendingNotePosition = pendingNote?.position || { x: 0, y: 0 };

  return (
    <NoteManagerContext.Provider value={{ requestNote }}>
      {/* Render note icons */}
      {relevantNotes.map((note) => (
        <NoteIcon key={note.id} note={note} onOpen={handleOpenNote} />
      ))}

      {/* Render open note bubble */}
      {openNote && (
        <NoteBubble
          initialNote={openNote.note}
          onClose={handleCloseNote}
          onDelete={handleDeleteNote}
          onSave={handleSaveNote}
          position={openNote.position}
          text={openNote.text}
        />
      )}

      {/* Render pending note bubble */}
      {pendingNote && !openNoteId && (
        <NoteBubble
          key={`pending-${pendingNote.text.substring(0, 10)}`}
          onClose={handleCloseNote}
          onSave={handleSaveNote}
          position={pendingNotePosition}
          text={pendingNote.text}
        />
      )}

      {/* Render children with requestNote function */}
      {children?.(requestNote)}
    </NoteManagerContext.Provider>
  );
}
