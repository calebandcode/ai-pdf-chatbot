"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import type { UseChatHelpers } from "@ai-sdk/react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Edit2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Response } from "../elements/response";
import { MessageActions } from "../message-actions";

type QuestionAnswerBlockProps = {
  question: string;
  answer: string;
  questionId?: string;
  answerId?: string;
  documentIds?: string[];
  isStreaming?: boolean;
  isReadonly?: boolean;
  chatId?: string;
  message?: ChatMessage;
  vote?: Vote;
  setMessages?: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate?: UseChatHelpers<ChatMessage>["regenerate"];
  onEdit?: (newAnswer: string) => void;
};

export function QuestionAnswerBlock({
  question,
  answer,
  questionId,
  answerId,
  documentIds = [],
  isStreaming = false,
  isReadonly = false,
  chatId,
  message,
  vote,
  setMessages,
  regenerate,
  onEdit,
}: QuestionAnswerBlockProps) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  
  // Store original answer blocks for cancel functionality
  const [originalBlocks, setOriginalBlocks] = useState<PartialBlock[]>([]);

  // Create BlockNote editor instance first - needed for markdown parsing
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null);

  // Initialize editor once
  useEffect(() => {
    if (editor) return; // Editor already exists

    // Create editor with empty content initially
    const editorInstance = BlockNoteEditor.create({
      initialContent: [{ type: "paragraph", content: "" }],
    });

    setEditor(editorInstance);

    // Cleanup on unmount
    return () => {
      try {
        editorInstance._tiptapEditor?.destroy();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []); // Only run once

  // Parse markdown and update editor content when answer changes
  useEffect(() => {
    if (!editor || !answer || isStreaming) {
      return;
    }

    // Use the editor's markdown parsing method - this uses the editor's schema
    const updateContent = () => {
      try {
        // Use editor's tryParseMarkdownToBlocks - this handles the schema correctly
        const blocks = editor.tryParseMarkdownToBlocks(answer);
        
        if (blocks && blocks.length > 0) {
          // Store original blocks for cancel functionality
          setOriginalBlocks(blocks);
          // Replace all blocks with parsed content (includes formatting)
          editor.replaceBlocks(editor.document, blocks);
        } else {
          // If parsing returns empty, create a single paragraph block
          const fallbackBlocks: PartialBlock[] = [
            {
              type: "paragraph",
              content: [{ type: "text", text: answer, styles: {} }],
            },
          ];
          setOriginalBlocks(fallbackBlocks);
          editor.replaceBlocks(editor.document, fallbackBlocks);
        }
      } catch (error) {
        console.error("Markdown parsing error:", error);
        
        // Fallback: create blocks manually (no formatting)
        const paragraphs = answer.split(/\n\n+/).filter((p) => p.trim());
        const fallbackBlocks: PartialBlock[] =
          paragraphs.length > 0
            ? paragraphs.map((p) => ({
                type: "paragraph" as const,
                content: [{ type: "text", text: p.trim(), styles: {} }],
              }))
            : [{ type: "paragraph" as const, content: [{ type: "text", text: answer, styles: {} }] }];
        setOriginalBlocks(fallbackBlocks);
        editor.replaceBlocks(editor.document, fallbackBlocks);
      }
    };

    updateContent();
  }, [editor, answer, isStreaming]);

  // Update editable state when isEditing changes
  useEffect(() => {
    if (editor) {
      editor.isEditable = isEditing && !isReadonly;
    }
  }, [editor, isEditing, isReadonly]);

  const handleSave = async () => {
    if (!editor) return;
    
    // Get the current editor content and convert to markdown/text
    const textContent = editor.blocksToMarkdownLossy(editor.topLevelBlocks).trim();

    if (onEdit) {
      onEdit(textContent);
    } else if (setMessages && message) {
      // Update the message in the messages array
      setMessages((messages) =>
        messages.map((msg) => {
          if (msg.id === message.id) {
            return {
              ...msg,
              parts: msg.parts.map((part) =>
                part.type === "text"
                  ? { ...part, text: textContent }
                  : part
              ),
            };
          }
          return msg;
        })
      );
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (!editor) return;
    
    // Reset editor content to original blocks
    if (originalBlocks.length > 0) {
      editor.replaceBlocks(editor.document, originalBlocks);
    } else {
      // Fallback: re-parse the original answer
      try {
        const blocks = editor.tryParseMarkdownToBlocks(answer);
        if (blocks && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
        }
      } catch {
        // If parsing fails, create a simple paragraph
        editor.replaceBlocks(editor.document, [
          {
            type: "paragraph",
            content: [{ type: "text", text: answer, styles: {} }],
          },
        ]);
      }
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group/qa-block w-full my-4"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Question Section - Minimal, inline with BlockNote style */}
      <div className="mb-3 flex items-start gap-2">
        <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 text-sm text-muted-foreground italic">
          {sanitizeText(question)}
        </div>
      </div>

      {/* Answer Section - Pure BlockNote, no wrapper styling */}
      <div className="relative w-full">
        {!isReadonly && !isEditing && (
          <button
            className="absolute -top-6 right-0 z-10 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/qa-block:opacity-100"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            <Edit2 className="size-3" />
            Edit
          </button>
        )}
        
        {isEditing && editor ? (
          <div className="space-y-3">
            <BlockNoteView
              editor={editor}
              editable={true}
              theme={theme === "dark" ? "dark" : "light"}
            />
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={handleSave}
                type="button"
              >
                Save
              </button>
              <button
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                onClick={handleCancel}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isStreaming ? (
          <div className="prose prose-sm max-w-none">
            <Response isStreaming={true} speed={20}>
              {sanitizeText(answer)}
            </Response>
          </div>
        ) : editor ? (
          <BlockNoteView
            editor={editor}
            editable={false}
            theme={theme === "dark" ? "dark" : "light"}
          />
        ) : (
          <div className="prose prose-sm max-w-none">
            {sanitizeText(answer)}
          </div>
        )}
      </div>

      {/* Actions - Minimal, at the bottom */}
      {!isReadonly && message && chatId && !isEditing && (
        <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border/30">
          <MessageActions
            chatId={chatId}
            isLoading={isStreaming}
            message={message}
            setMode={() => {}}
            vote={vote}
          />
        </div>
      )}
    </motion.div>
  );
}

