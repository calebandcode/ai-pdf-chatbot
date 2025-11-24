"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  Sparkles,
  Brain,
  MessageSquare,
  Edit2,
  Loader2,
} from "lucide-react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  generateTopicExplanationAction,
  generateSubtopicExplanationAction,
} from "@/app/actions/generate-explanations";
import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";

type TopicBlockRendererProps = {
  block: PartialBlock;
  editor: BlockNoteEditorType;
  chatId: string;
  documentIds: string[];
  documentTitle?: string;
  depth?: number; // For visual indentation (0 = topic, 1+ = subtopic)
  allBlocks?: PartialBlock[]; // All blocks for hierarchy lookup (including topic blocks)
  onUpdate?: (blockId: string, updates: Partial<PartialBlock>) => void;
};

export function TopicBlockRenderer({
  block,
  editor,
  chatId,
  documentIds,
  documentTitle,
  depth = 0,
  allBlocks = [],
  onUpdate,
}: TopicBlockRendererProps) {
  const { theme } = useTheme();
  const props = (block.props || {}) as {
    topicName?: string;
    description?: string;
    explanation?: string;
    topicId?: string;
    parentTopicId?: string | null;
    subtopicIds?: string[];
    isSubtopic?: boolean;
    collapsed?: boolean;
    isGenerating?: boolean;
    pages?: number[];
    history?: Array<{
      timestamp: number;
      content: string;
      source: "user" | "ai";
    }>;
  };

  const topicName = props.topicName || "";
  const description = props.description || "";
  const explanation = props.explanation || "";
  const isSubtopic = props.isSubtopic || false;
  const pages = props.pages || [];
  const topicId = props.topicId || block.id || "";

  // Local state
  const [isCollapsed, setIsCollapsed] = useState(
    props.collapsed !== undefined ? props.collapsed : true
  );
  const [isGenerating, setIsGenerating] = useState(
    props.isGenerating || false
  );
  const [isEditing, setIsEditing] = useState(false);
  const [explanationEditor, setExplanationEditor] =
    useState<BlockNoteEditorType | null>(null);
  const [hasExplanation, setHasExplanation] = useState(
    !!explanation && explanation.trim().length > 0
  );

  // Sync collapsed state with block props
  useEffect(() => {
    if (props.collapsed !== undefined && props.collapsed !== isCollapsed) {
      setIsCollapsed(props.collapsed);
    }
  }, [props.collapsed, isCollapsed]);

  // Sync explanation with block props
  useEffect(() => {
    const hasExp = !!explanation && explanation.trim().length > 0;
    setHasExplanation(hasExp);
  }, [explanation]);

  // Initialize editor for explanation viewing/editing
  useEffect(() => {
    if (!hasExplanation && !isEditing) {
      return;
    }

    const editorInstance = BlockNoteEditor.create({
      initialContent: hasExplanation
        ? editor.tryParseMarkdownToBlocks(explanation) || [
            { type: "paragraph", content: explanation },
          ]
        : [{ type: "paragraph", content: "" }],
    });

    editorInstance.isEditable = isEditing;

    setExplanationEditor(editorInstance);

    return () => {
      try {
        editorInstance._tiptapEditor?.destroy();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [hasExplanation, isEditing, explanation, editor]);

  // Toggle collapse
  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    // Update block in editor
    if (onUpdate && topicId) {
      onUpdate(topicId, {
        props: {
          ...props,
          collapsed: newCollapsed,
        },
      });
    }
  };

  // Generate explanation
  const handleGenerateExplanation = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    if (onUpdate && topicId) {
      onUpdate(topicId, {
        props: {
          ...props,
          isGenerating: true,
        },
      });
    }

    try {
      // Find parent topic if this is a subtopic
      // Look in allBlocks array (not editor.topLevelBlocks) since topic blocks aren't in the editor
      const parentTopicName =
        isSubtopic && props.parentTopicId
          ? (() => {
              const parentBlock = allBlocks.find(
                (b) =>
                  (b.type as string) === "topicExplanation" &&
                  ((b.props || {}) as { topicId?: string }).topicId ===
                    props.parentTopicId
              );
              return parentBlock
                ? ((parentBlock.props || {}) as { topicName?: string })
                    .topicName || ""
                : "";
            })()
          : "";

      const result = isSubtopic
        ? await generateSubtopicExplanationAction({
            parentTopic: parentTopicName,
            subtopicName: topicName,
            description,
            pages,
            documentTitle,
            documentIds,
            previousTopics: [],
            currentIndex: 0,
            totalTopics: 1,
          })
        : await generateTopicExplanationAction({
            topicName,
            description,
            pages,
            documentTitle,
            documentIds,
            previousTopics: [],
            currentIndex: 0,
            totalTopics: 1,
          });

      if (result.success && result.explanation) {
        // Update block with new explanation
        const updatedHistory = [
          ...(props.history || []),
          {
            timestamp: Date.now(),
            content: result.explanation,
            source: "ai" as const,
          },
        ].slice(-5); // Keep last 5 versions

        if (onUpdate && topicId) {
          onUpdate(topicId, {
            props: {
              ...props,
              explanation: result.explanation,
              isGenerating: false,
              collapsed: false, // Expand after generating
              history: updatedHistory,
            },
          });
        }

        setHasExplanation(true);
        setIsCollapsed(false);
      }
    } catch (error) {
      console.error("Failed to generate explanation:", error);
    } finally {
      setIsGenerating(false);
      if (onUpdate && topicId) {
        onUpdate(topicId, {
          props: {
            ...props,
            isGenerating: false,
          },
        });
      }
    }
  };

  // Handle quiz (placeholder)
  const handleQuiz = () => {
    // TODO: Implement quiz functionality
    console.log("Quiz for topic:", topicName);
  };

  // Handle ask question (placeholder)
  const handleAskQuestion = () => {
    // TODO: Implement topic chat functionality
    console.log("Ask question for topic:", topicName);
  };

  // Handle edit
  const handleEdit = () => {
    setIsEditing(true);
    if (explanationEditor) {
      explanationEditor.isEditable = true;
    }
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!explanationEditor) return;

    const blocks = explanationEditor.topLevelBlocks;
    const markdown = explanationEditor.blocksToMarkdownLossy(blocks);

    // Update block with edited explanation
    const updatedHistory = [
      ...(props.history || []),
      {
        timestamp: Date.now(),
        content: markdown,
        source: "user" as const,
      },
    ].slice(-5); // Keep last 5 versions

    if (onUpdate && topicId) {
      onUpdate(topicId, {
        props: {
          ...props,
          explanation: markdown,
          history: updatedHistory,
        },
      });
    }

    setIsEditing(false);
    if (explanationEditor) {
      explanationEditor.isEditable = false;
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    if (explanationEditor) {
      explanationEditor.isEditable = false;
      // Reset editor content to original explanation
      if (explanation) {
        const blocks = editor.tryParseMarkdownToBlocks(explanation) || [
          { type: "paragraph", content: explanation },
        ];
        explanationEditor.replaceBlocks(explanationEditor.document, blocks);
      }
    }
  };

  // Calculate indentation based on depth
  const indentLevel = depth * 24; // 24px per level

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "my-3 rounded-lg border bg-background/50 backdrop-blur-sm",
        isSubtopic && "border-l-2 border-l-blue-500/30",
        depth > 0 && "ml-6"
      )}
      style={{ marginLeft: `${indentLevel}px` }}
    >
      {/* Topic Header */}
      <div
        className={cn(
          "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg",
          !isCollapsed && "border-b"
        )}
        onClick={handleToggleCollapse}
      >
        {/* Collapse Icon */}
        <button
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleCollapse();
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>

        {/* Topic Icon */}
        <BookOpen
          className={cn(
            "mt-0.5 size-4 shrink-0",
            isSubtopic
              ? "text-muted-foreground"
              : "text-blue-600 dark:text-blue-400"
          )}
        />

        {/* Topic Info */}
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "font-semibold",
              isSubtopic
                ? "text-sm text-muted-foreground"
                : "text-base text-foreground"
            )}
          >
            {topicName}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">
              {description}
            </p>
          )}
          {pages.length > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="size-3" />
              <span>
                {pages.length} reference{pages.length !== 1 ? "s" : ""} • Pages{" "}
                {pages.join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isCollapsed && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {!hasExplanation && !isGenerating && (
              <button
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={handleGenerateExplanation}
                type="button"
                title="Generate Explanation"
              >
                <Sparkles className="size-3" />
                Explain
              </button>
            )}
            {hasExplanation && !isEditing && (
              <button
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={handleEdit}
                type="button"
                title="Edit Explanation"
              >
                <Edit2 className="size-3" />
                Edit
              </button>
            )}
            {hasExplanation && (
              <>
                <button
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={handleQuiz}
                  type="button"
                  title="Generate Quiz"
                >
                  <Brain className="size-3" />
                  Quiz
                </button>
                <button
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={handleAskQuestion}
                  type="button"
                  title="Ask Question"
                >
                  <MessageSquare className="size-3" />
                  Ask
                </button>
              </>
            )}
            {isGenerating && (
              <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Generating...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Topic Content (Explanation) */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {hasExplanation && explanationEditor ? (
                <div className="space-y-3">
                  {/* Explanation Editor */}
                  <div className="rounded-md border bg-background">
                    <BlockNoteView
                      editor={explanationEditor}
                      editable={isEditing}
                      theme={theme === "dark" ? "dark" : "light"}
                    />
                  </div>

                  {/* Edit Actions */}
                  {isEditing && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                        onClick={handleCancelEdit}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-md px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        onClick={handleSaveEdit}
                        type="button"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              ) : isGenerating ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mr-2" />
                  <span>Generating explanation...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  <button
                    className="flex items-center gap-2 rounded-md px-4 py-2 bg-muted hover:bg-muted/80 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateExplanation();
                    }}
                    type="button"
                  >
                    <Sparkles className="size-4" />
                    Generate Explanation
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

