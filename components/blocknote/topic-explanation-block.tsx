"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import type { UseChatHelpers } from "@ai-sdk/react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { BookOpen, ChevronDown, ChevronRight, Edit2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Response } from "../elements/response";

type TopicExplanationBlockProps = {
  topicName: string;
  description: string;
  explanation: string;
  documentIds?: string[];
  topicId?: string;
  parentTopicId?: string | null;
  subtopicIds?: string[];
  isSubtopic?: boolean;
  isStreaming?: boolean;
  isReadonly?: boolean;
  chatId?: string;
  onEdit?: (newExplanation: string) => void;
  onGenerateExplanation?: () => void;
};

export function TopicExplanationBlock({
  topicName,
  description,
  explanation,
  documentIds = [],
  topicId,
  parentTopicId,
  subtopicIds = [],
  isSubtopic = false,
  isStreaming = false,
  isReadonly = false,
  chatId,
  onEdit,
  onGenerateExplanation,
}: TopicExplanationBlockProps) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [originalBlocks, setOriginalBlocks] = useState<PartialBlock[]>([]);
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null);

  // Initialize editor for viewing (non-editing mode)
  useEffect(() => {
    if (isEditing || isReadonly || !explanation) {
      return;
    }

    // Create editor instance for viewing
    const editorInstance = BlockNoteEditor.create({
      initialContent: [{ type: "paragraph", content: "" }],
    });

    editorInstance.isEditable = false;

    // Parse explanation to blocks
    try {
      const blocks = editorInstance.tryParseMarkdownToBlocks(explanation);
      if (blocks && blocks.length > 0) {
        setOriginalBlocks(blocks);
        editorInstance.replaceBlocks(editorInstance.document, blocks);
      } else {
        // Fallback: create a simple paragraph block
        const fallbackBlocks: PartialBlock[] = [
          {
            type: "paragraph",
            content: [{ type: "text", text: explanation, styles: {} }],
          },
        ];
        setOriginalBlocks(fallbackBlocks);
        editorInstance.replaceBlocks(editorInstance.document, fallbackBlocks);
      }
    } catch (error) {
      console.error("Failed to parse explanation:", error);
      // Fallback: create a simple paragraph block
      const fallbackBlocks: PartialBlock[] = [
        {
          type: "paragraph",
          content: [{ type: "text", text: explanation, styles: {} }],
        },
      ];
      setOriginalBlocks(fallbackBlocks);
      editorInstance.replaceBlocks(editorInstance.document, fallbackBlocks);
    }

    setEditor(editorInstance);

    return () => {
      try {
        editorInstance._tiptapEditor?.destroy();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [explanation, isEditing, isReadonly]);

  // Initialize editor for editing mode
  useEffect(() => {
    if (!isEditing || isReadonly) {
      return;
    }

    // Destroy existing editor if switching to edit mode
    if (editor) {
      try {
        editor._tiptapEditor?.destroy();
      } catch {
        // Ignore cleanup errors
      }
      setEditor(null);
    }

    // Create new editor for editing
    const editorInstance = BlockNoteEditor.create({
      initialContent: originalBlocks.length > 0 
        ? originalBlocks 
        : [{ type: "paragraph", content: explanation || "" }],
    });

    editorInstance.isEditable = true;
    setEditor(editorInstance);

    return () => {
      try {
        editorInstance._tiptapEditor?.destroy();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [isEditing, isReadonly, originalBlocks, explanation]);

  const handleSave = async () => {
    if (!editor || !onEdit) return;

    const textContent = editor.blocksToMarkdownLossy(editor.topLevelBlocks).trim();
    onEdit(textContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (!editor) return;
    editor.replaceBlocks(editor.document, originalBlocks);
    setIsEditing(false);
  };

  const indentLevel = isSubtopic ? 2 : 0;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group/topic-block w-full my-3",
        isSubtopic && "ml-6 border-l-2 border-border/30 pl-4"
      )}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Topic Header */}
      <div
        className={cn(
          "flex items-start gap-2 mb-2 cursor-pointer hover:bg-muted/50 rounded-md p-2 -ml-2 transition-colors",
          isCollapsed && "mb-0"
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {!isSubtopic && (
          <button
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            type="button"
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        )}
        <BookOpen
          className={cn(
            "mt-0.5 size-4 shrink-0",
            isSubtopic ? "text-muted-foreground" : "text-blue-600 dark:text-blue-400"
          )}
        />
        <div className="flex-1">
          <div className={cn(
            "font-medium",
            isSubtopic ? "text-sm text-muted-foreground" : "text-base text-foreground"
          )}>
            {topicName}
          </div>
          {description && !isCollapsed && (
            <div className="mt-1 text-xs text-muted-foreground italic">
              {description}
            </div>
          )}
        </div>
        {!isReadonly && !isEditing && !isCollapsed && (
          <button
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/topic-block:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            type="button"
          >
            <Edit2 className="size-3" />
            Edit
          </button>
        )}
      </div>

      {/* Explanation Content */}
      {!isCollapsed && (
        <div className="relative w-full ml-7">
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
                {sanitizeText(explanation)}
              </Response>
            </div>
          ) : editor && explanation ? (
            <BlockNoteView
              editor={editor}
              editable={false}
              theme={theme === "dark" ? "dark" : "light"}
            />
          ) : explanation ? (
            <div className="prose prose-sm max-w-none">
              {sanitizeText(explanation)}
            </div>
          ) : onGenerateExplanation ? (
            <button
              className="rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={onGenerateExplanation}
              type="button"
            >
              Generate explanation
            </button>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}

