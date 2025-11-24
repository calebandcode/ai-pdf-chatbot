"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState, useCallback } from "react";
import { customBlockSpecs } from "@/lib/blocknote/schema";
import { loadNotebookBlocksAction, saveNotebookBlocksAction } from "@/app/actions/notebook-blocks";
import type { NotebookBlock } from "@/lib/db/schema";
import { TopicBlockRenderer } from "./topic-block-renderer";

type UnifiedNotebookEditorProps = {
  chatId: string;
  initialBlocks?: PartialBlock[];
  editable?: boolean;
  onBlocksChange?: (blocks: PartialBlock[]) => void;
  autoSave?: boolean;
  autoSaveDelay?: number;
  documentIds?: string[];
  documentTitle?: string;
};

export function UnifiedNotebookEditor({
  chatId,
  initialBlocks,
  editable = true,
  onBlocksChange,
  autoSave = true,
  autoSaveDelay = 1000, // 1 second debounce
  documentIds = [],
  documentTitle,
}: UnifiedNotebookEditorProps) {
  const { theme } = useTheme();
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null);
  const [blocks, setBlocks] = useState<PartialBlock[]>(initialBlocks || []);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [editorKey, setEditorKey] = useState(0); // Force re-render key
  
  // Update blocks when initialBlocks changes (e.g., new explanation generated)
  useEffect(() => {
    if (initialBlocks && initialBlocks.length > 0) {
      setBlocks(initialBlocks);
    }
  }, [initialBlocks]);

  // Extract documentIds and documentTitle from blocks if not provided
  const extractedDocInfo = useMemo(() => {
    let docIds: string[] = documentIds;
    let docTitle: string | undefined = documentTitle;

    // Try to extract from source blocks
    for (const block of blocks) {
      if ((block.type as string) === "source" && block.props) {
        const props = block.props as Record<string, unknown>;
        if (props.documentId && typeof props.documentId === "string") {
          if (!docIds.includes(props.documentId)) {
            docIds = [...docIds, props.documentId];
          }
        }
        if (!docTitle && props.title && typeof props.title === "string") {
          docTitle = props.title;
        }
      }
      // Also check topic blocks for documentIds
      if ((block.type as string) === "topicExplanation" && block.props) {
        const props = block.props as Record<string, unknown>;
        if (Array.isArray(props.documentIds)) {
          for (const id of props.documentIds) {
            if (typeof id === "string" && !docIds.includes(id)) {
              docIds = [...docIds, id];
            }
          }
        }
      }
    }

    return { documentIds: docIds, documentTitle: docTitle };
  }, [blocks, documentIds, documentTitle]);

  // Separate topic blocks from standard blocks
  // MUST be defined before any early returns (React hooks rule)
  // Always ensure topicBlocks and standardBlocks are defined (never undefined)
  const topicBlocksMemo = useMemo(() => {
    const topics: PartialBlock[] = [];
    const standards: PartialBlock[] = [];

    // Ensure blocks is always an array
    const blocksArray = Array.isArray(blocks) ? blocks : [];

    for (let i = 0; i < blocksArray.length; i++) {
      const block = blocksArray[i];
      if (block && (block.type as string) === "topicExplanation") {
        topics.push(block);
      } else if (block) {
        standards.push(block);
      }
    }

    return {
      topicBlocks: topics,
      standardBlocks: standards,
    };
  }, [blocks]);

  // Destructure with safe defaults to ensure variables are always defined
  const topicBlocks = topicBlocksMemo?.topicBlocks ?? [];
  const standardBlocks = topicBlocksMemo?.standardBlocks ?? [];

  // Load blocks from database on mount
  useEffect(() => {
    const loadBlocks = async () => {
      if (!chatId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const dbBlocks = await loadNotebookBlocksAction({ chatId });

        if (dbBlocks.length > 0) {
          console.log(`Loaded ${dbBlocks.length} blocks from database`);
          // Convert database blocks to BlockNote blocks
          // Sort by blockOrder to maintain order
          const sortedBlocks = [...dbBlocks].sort((a, b) => a.blockOrder - b.blockOrder);
          
          const blockNoteBlocks = sortedBlocks
            .map((dbBlock) => {
              const blockType = dbBlock.blockData.type as string;
              const blockProps = dbBlock.blockData.props || {};
              const blockContent = dbBlock.blockData.content;
              
              // Ensure content is always an array
              let normalizedContent: unknown[] = [];
              if (Array.isArray(blockContent)) {
                normalizedContent = blockContent;
              } else if (blockContent !== undefined && blockContent !== null) {
                // If content is not an array, log warning and use empty array
                console.warn(`Block ${dbBlock.id} has invalid content format, using empty array`);
                normalizedContent = [];
              }
              
              return {
                // Don't include id - BlockNote will generate its own
                type: blockType,
                props: blockProps,
                content: normalizedContent,
              } as PartialBlock;
            })
            .filter((block): block is PartialBlock => {
              // Filter out blocks with invalid types
              if (!block.type) {
                console.warn("Block has no type, filtering out");
                return false;
              }
              return true;
            });

          console.log(`Converted ${blockNoteBlocks.length} database blocks to BlockNote blocks`);
          
          // Check if database blocks have meaningful content
          // We want to use database blocks if they have summary, topics, or Q&A content
          // But if they only have source blocks, we should prefer initialBlocks (which might have more complete data)
          const hasMeaningfulContent = blockNoteBlocks.some((block) => {
            // Check if block has text content
            if (Array.isArray(block.content) && block.content.length > 0) {
              // Check if content has text elements
              const hasText = block.content.some((item) => {
                if (typeof item === "object" && item !== null && "type" in item) {
                  return item.type === "text" && (item as { text?: string }).text?.trim();
                }
                return false;
              });
              if (hasText) return true;
            }
            // Check if it's a questionAnswer block with question or answer
            if ((block.type as string) === "questionAnswer" && block.props) {
              const props = block.props as Record<string, unknown>;
              if (props.question || props.answer) return true;
            }
            // Check if it's a summary block with summary text
            if ((block.type as string) === "summary" && block.props) {
              const props = block.props as Record<string, unknown>;
              if (props.summary && typeof props.summary === "string" && props.summary.trim()) return true;
            }
            // Check if it's a topicExplanation block
            if ((block.type as string) === "topicExplanation" && block.props) {
              const props = block.props as Record<string, unknown>;
              if (props.topicName || props.description || props.explanation) return true;
            }
            // Source blocks alone are NOT considered meaningful enough - we need summary/topics too
            // (Source blocks will be recreated from initialBlocks anyway)
            return false;
          });
          
          console.log("🔍 Database blocks meaningful content check:", {
            totalBlocks: blockNoteBlocks.length,
            hasMeaningfulContent,
            blockTypes: blockNoteBlocks.map(b => b.type),
          });
          
          // CRITICAL: In Edit Mode, ALWAYS use initialBlocks (they're already filtered)
          // Database blocks might contain old topic structures that shouldn't be shown
          // initialBlocks are generated fresh from savedBlocks and summary, already filtered
          // NEVER use database blocks in Edit Mode - they may contain topics from previous saves
          const isEditMode = editable !== false; // Assume Edit Mode if editable (default is true)
          
          // In Edit Mode: ALWAYS use initialBlocks if available (they're pre-filtered, no topics)
          // In Agent Mode: Use initialBlocks if they have better data, otherwise use database
          let shouldUseInitialBlocks: boolean;
          
          if (isEditMode) {
            // Edit Mode: ALWAYS use initialBlocks (they're filtered to remove topics)
            // Even if initialBlocks is empty, don't use database blocks (they may contain topics)
            shouldUseInitialBlocks = true; // Always true in Edit Mode - use initialBlocks even if empty
            console.log("🔒 Edit Mode: Always using initialBlocks (pre-filtered, no topics)", {
              initialBlocksCount: initialBlocks?.length || 0,
              databaseBlocksCount: blockNoteBlocks.length,
            });
          } else {
            // Agent Mode: Use initialBlocks if they have better data
            const initialBlocksHaveSummaryOrTopics = initialBlocks && initialBlocks.some((block) => {
              return (block.type as string) === "summary" || (block.type as string) === "topicExplanation";
            });
            
            shouldUseInitialBlocks = initialBlocks && initialBlocks.length > 0 && (
              !hasMeaningfulContent || 
              initialBlocksHaveSummaryOrTopics || 
              initialBlocks.length > blockNoteBlocks.length
            );
          }
          
          if (shouldUseInitialBlocks) {
            console.log("✅ Using initialBlocks:", {
              reason: isEditMode ? "Edit Mode - using filtered initialBlocks" : !hasMeaningfulContent ? "database lacks meaningful content" : initialBlocksHaveSummaryOrTopics ? "initialBlocks have summary/topics" : "initialBlocks have more blocks",
              databaseBlocks: blockNoteBlocks.length,
              databaseBlockTypes: blockNoteBlocks.map(b => b.type),
              initialBlocks: initialBlocks.length,
              initialBlockTypes: initialBlocks.map(b => b.type),
              initialBlocksHaveSummaryOrTopics,
              isEditMode,
            });
            console.log("📦 Initial blocks sample:", initialBlocks.slice(0, 3).map((b) => ({
              type: b.type,
              hasProps: !!b.props,
              propsKeys: b.props ? Object.keys(b.props) : [],
            })));
            // Normalize initial blocks
            const normalizedInitialBlocks = initialBlocks
              .map((block, idx) => {
                if (!block || typeof block !== "object" || !block.type) {
                  console.warn(`Block ${idx} is invalid:`, block);
                  return null;
                }
                
                // Ensure content is an array
                let content: unknown[] = [];
                if (Array.isArray(block.content)) {
                  content = block.content;
                } else if (typeof block.content === "string") {
                  const text = block.content.trim();
                  const blockType = block.type as string;
                  if (text && (blockType === "paragraph" || blockType === "heading")) {
                    content = [{ type: "text", text, styles: {} }];
                  }
                }
                
                // Ensure props is an object
                const props = (typeof block.props === "object" && block.props !== null && !Array.isArray(block.props))
                  ? block.props
                  : {};
                
                return {
                  type: block.type,
                  props,
                  content,
                } as PartialBlock;
              })
              .filter((block): block is PartialBlock => block !== null);
            
            console.log(`Using ${normalizedInitialBlocks.length} initial blocks instead of database blocks`);
            setBlocks(normalizedInitialBlocks.length > 0 ? normalizedInitialBlocks : [{ type: "paragraph", content: [] }]);
          } else {
            // Use database blocks (Agent Mode only - Edit Mode should never reach here)
            const isEditModeCheck = editable !== false;
            
            if (isEditModeCheck) {
              // This should NEVER happen - Edit Mode should always use initialBlocks
              console.error("❌ CRITICAL BUG: Edit Mode reached database blocks path! This should never happen.");
              console.error("❌ Edit Mode should ALWAYS use initialBlocks (pre-filtered, no topics)");
              // Return empty array - don't show database blocks with topics
              setBlocks([]);
            } else {
              // Agent Mode: use database blocks
              setBlocks(blockNoteBlocks);
            }
          }
        } else if (initialBlocks && initialBlocks.length > 0) {
          console.log(`Using ${initialBlocks.length} initial blocks (no database blocks found)`);
          console.log("Initial blocks:", JSON.stringify(initialBlocks, null, 2));
          
          // Normalize initial blocks the same way we normalize database blocks
          const normalizedInitialBlocks = initialBlocks
            .map((block, idx) => {
              if (!block || typeof block !== "object" || !block.type) {
                console.warn(`Block ${idx} is invalid:`, block);
                return null;
              }
              
              // Ensure content is an array
              let content: unknown[] = [];
              if (Array.isArray(block.content)) {
                content = block.content;
              } else if (typeof block.content === "string") {
                const text = block.content.trim();
                const blockType = block.type as string;
                if (text && (blockType === "paragraph" || blockType === "heading")) {
                  content = [{ type: "text", text, styles: {} }];
                }
              }
              
              // Ensure props is an object
              const props = (typeof block.props === "object" && block.props !== null && !Array.isArray(block.props))
                ? block.props
                : {};
              
              const normalized = {
                type: block.type,
                props,
                content,
              } as PartialBlock;
              
              console.log(`Normalized block ${idx}:`, normalized.type, "props:", Object.keys(props), "content length:", content.length);
              
              return normalized;
            })
            .filter((block): block is PartialBlock => block !== null);
          
          console.log(`Normalized ${normalizedInitialBlocks.length} initial blocks`);
          setBlocks(normalizedInitialBlocks.length > 0 ? normalizedInitialBlocks : [{ type: "paragraph", content: [] }]);
        } else {
          console.log("No blocks found, creating empty editor");
          // Create empty editor with proper block structure
          setBlocks([{ type: "paragraph", content: [] }]);
        }
      } catch (error) {
        console.warn("Failed to load notebook blocks, using initial blocks:", error);
        // Gracefully fallback to initial blocks or empty editor
        // This handles cases where the table doesn't exist yet or there's a connection issue
        if (initialBlocks && initialBlocks.length > 0) {
          console.log(`Fallback: Using ${initialBlocks.length} initial blocks`);
          setBlocks(initialBlocks);
        } else {
          console.log("Fallback: Creating empty editor");
          setBlocks([{ type: "paragraph", content: [] }]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]); // Only depend on chatId to avoid reloading when initialBlocks change

  // Initialize editor with blocks (only after loading completes)
  useEffect(() => {
    if (isLoading) {
      return;
    }

    // Create new editor instance only once when blocks are ready
    // Don't recreate or update if editor already exists - blocks are loaded once on mount
    if (editor) {
      return;
    }

    // Create editor with minimal valid content first, then replace with actual content
    // BlockNote requires initialContent to be a non-empty array
    try {
      console.log(`Creating editor (will insert ${blocks.length} blocks after creation)`);
      
      // Create editor with a minimal valid paragraph block
      // BlockNote requires at least one block with valid structure
      const editorInstance = BlockNoteEditor.create({
        initialContent: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "", styles: {} }],
          },
        ],
        blockSpecs: customBlockSpecs, // Include custom blocks (topicExplanation, etc.)
      });
      
      console.log("Editor created successfully with minimal content and custom block specs");

      editorInstance.isEditable = editable;

      // Set up change handler for auto-save
      if (autoSave && chatId) {
        editorInstance.onChange(() => {
          const currentBlocks = editorInstance.topLevelBlocks;

          // Clear existing timeout
          if (saveTimeout) {
            clearTimeout(saveTimeout);
          }

          // Set new timeout for debounced save
          const timeout = setTimeout(async () => {
            try {
              setIsSaving(true);
              await saveNotebookBlocksAction({
                chatId,
                blocks: currentBlocks,
              });
            } catch (error) {
              console.error("Failed to save notebook blocks:", error);
            } finally {
              setIsSaving(false);
            }
          }, autoSaveDelay);

          setSaveTimeout(timeout);

          // Call onBlocksChange callback
          if (onBlocksChange) {
            onBlocksChange(currentBlocks);
          }
        });
      }

      setEditor(editorInstance);

      // Cleanup
      return () => {
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }
        try {
          editorInstance._tiptapEditor?.destroy();
        } catch {
          // Ignore cleanup errors
        }
      };
    } catch (error) {
      console.error("Error creating BlockNote editor:", error);
      // Create a minimal editor as fallback
      const fallbackEditor = BlockNoteEditor.create({
        initialContent: [{ type: "paragraph", content: [] }],
        blockSpecs: customBlockSpecs,
      });
      fallbackEditor.isEditable = editable;
      setEditor(fallbackEditor);
      
      return () => {
        try {
          fallbackEditor._tiptapEditor?.destroy();
        } catch {
          // Ignore cleanup errors
        }
      };
    }
  }, [isLoading, blocks, editable, autoSave, chatId, autoSaveDelay, onBlocksChange, saveTimeout]); // Re-run when dependencies change

  // Calculate depth for topic blocks (for visual hierarchy)
  // NOTE: topicBlocks and standardBlocks are already defined above (before early returns)
  const topicDepths = useMemo(() => {
    const depths = new Map<string | undefined, number>();
    
    // Multiple passes to handle subtopics that might come before their parents
    // First pass: set depths for topics (non-subtopics)
    for (const block of topicBlocks) {
      const props = (block.props || {}) as {
        topicId?: string;
        parentTopicId?: string | null;
        isSubtopic?: boolean;
      };
      
      if (!props.isSubtopic) {
        // Use topicId as key since blocks might not have stable IDs yet
        const key = block.id || props.topicId || "";
        depths.set(key, 0);
      }
    }
    
    // Second pass: set depths for subtopics
    // We might need multiple iterations if subtopics have nested subtopics
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Safety limit
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      for (const block of topicBlocks) {
        const props = (block.props || {}) as {
          topicId?: string;
          parentTopicId?: string | null;
          isSubtopic?: boolean;
        };
        
        if (props.isSubtopic && props.parentTopicId) {
          const key = block.id || props.topicId || "";
          
          // Find parent topic
          const parentBlock = topicBlocks.find(
            (b) => {
              const parentProps = (b.props || {}) as { topicId?: string };
              return parentProps.topicId === props.parentTopicId;
            }
          );
          
          if (parentBlock) {
            const parentKey = parentBlock.id || props.parentTopicId || "";
            const parentDepth = depths.get(parentKey);
            
            if (parentDepth !== undefined) {
              const currentDepth = depths.get(key);
              const newDepth = parentDepth + 1;
              
              if (currentDepth === undefined || currentDepth !== newDepth) {
                depths.set(key, newDepth);
                changed = true;
              }
            }
          }
        }
      }
    }
    
    return depths;
  }, [topicBlocks]);

  // Handle block updates (from TopicBlockRenderer)
  const handleBlockUpdate = useCallback(
    (blockId: string, updates: Partial<PartialBlock>) => {
      setBlocks((prevBlocks) => {
        const updated = prevBlocks.map((block) => {
          if (block.id === blockId) {
            return {
              ...block,
              ...updates,
              props: {
                ...(block.props || {}),
                ...(updates.props || {}),
              },
            } as PartialBlock;
          }
          return block;
        });
        return updated as PartialBlock[];
      });

      // Update in editor if it exists (for standard blocks)
      if (editor) {
        try {
          const blockInEditor = editor.topLevelBlocks.find((b) => b.id === blockId);
          if (blockInEditor) {
            editor.updateBlock(blockInEditor, updates);
          }
        } catch (error) {
          console.error("Failed to update block in editor:", error);
        }
      }
    },
    [editor]
  );

  // Separate blocks: topic blocks (React components) vs standard blocks (BlockNote)
  // Only convert NON-topic blocks to BlockNote blocks
  useEffect(() => {
    if (!editor || blocks.length === 0) return;
    
    console.log("📝 Editor is ready, processing", blocks.length, "blocks");
    console.log("📝 Block types:", blocks.map((b) => b.type));
    
    // Filter out topicExplanation blocks - they'll be rendered as React components
    const blocksForBlockNote = blocks.filter((block) => (block.type as string) !== "topicExplanation");
    
    console.log("📝 Blocks for BlockNote:", blocksForBlockNote.length, "(topic blocks excluded)");
    
    // Convert remaining custom blocks to standard BlockNote blocks
    const blockNoteBlocks: PartialBlock[] = [];
    
    for (const block of blocksForBlockNote) {
      if (!block || typeof block !== "object" || !block.type) {
        console.warn("⚠️ Skipping invalid block:", block);
        continue;
      }
      
      console.log("🔄 Processing block type:", block.type);
      
      // Convert questionAnswer blocks to heading + paragraph blocks
      if ((block.type as string) === "questionAnswer" && block.props && typeof block.props === "object") {
        const props = block.props as Record<string, unknown>;
        const question = props.question;
        const answer = props.answer;
        
        console.log("Processing questionAnswer block - question:", typeof question === "string" ? question.substring(0, 50) : "none", "answer:", typeof answer === "string" ? answer.substring(0, 50) : "none");
        
        // Add question as a heading (only if question exists)
        if (typeof question === "string" && question.trim()) {
          blockNoteBlocks.push({
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: question, styles: { bold: true } }],
          });
          console.log("✅ Added question heading block");
        }
        
        // Add answer as paragraphs (parse markdown if needed)
        if (typeof answer === "string" && answer.trim()) {
          // Parse answer markdown into blocks using editor's parser
          try {
            const answerBlocks = editor.tryParseMarkdownToBlocks(answer);
            if (answerBlocks && answerBlocks.length > 0) {
              blockNoteBlocks.push(...answerBlocks);
              console.log(`✅ Added ${answerBlocks.length} answer blocks from markdown`);
            } else {
              // Fallback: create a paragraph block with the raw answer
              blockNoteBlocks.push({
                type: "paragraph",
                content: [{ type: "text", text: answer, styles: {} }],
              });
              console.log("✅ Added answer as single paragraph block (fallback)");
            }
          } catch (error) {
            console.error("❌ Error parsing answer markdown:", error);
            // Fallback: create a paragraph block with the raw answer
            blockNoteBlocks.push({
              type: "paragraph",
              content: [{ type: "text", text: answer, styles: {} }],
            });
            console.log("✅ Added answer as single paragraph block (error fallback)");
          }
        } else {
          console.warn("⚠️ questionAnswer block has no answer text");
        }
      }
      // Handle source blocks - show if title exists, otherwise skip (they're not useful without titles)
      else if ((block.type as string) === "source" && block.props && typeof block.props === "object") {
        const props = block.props as Record<string, unknown>;
        const title = props.title;
        const pageCount = props.pageCount;
        
        console.log("Processing source block - title:", title, "pageCount:", pageCount, "documentId:", props.documentId);
        
        // Only add source block if it has a title (skip empty source blocks to avoid clutter)
        if (typeof title === "string" && title.trim()) {
          const pageInfo = typeof pageCount === "number" && pageCount > 0 
            ? ` (${pageCount} page${pageCount > 1 ? 's' : ''})`
            : '';
          blockNoteBlocks.push({
            type: "heading",
            props: { level: 3 },
            content: [{ type: "text", text: `📄 ${title}${pageInfo}`, styles: {} }],
          });
          console.log("✅ Added source block with title:", title);
        } else {
          console.log("⏭️ Skipping source block - no title (documentId:", props.documentId, ")");
        }
      }
      // Handle summary blocks - convert to heading + paragraph
      else if ((block.type as string) === "summary" && block.props && typeof block.props === "object") {
        const props = block.props as Record<string, unknown>;
        const summary = props.summary;
        
        console.log("Processing summary block");
        
        if (typeof summary === "string" && summary.trim()) {
          // Add summary heading
          blockNoteBlocks.push({
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "Summary", styles: { bold: true } }],
          });
          
          // Parse summary markdown into blocks
          try {
            const summaryBlocks = editor.tryParseMarkdownToBlocks(summary);
            if (summaryBlocks && summaryBlocks.length > 0) {
              blockNoteBlocks.push(...summaryBlocks);
              console.log(`✅ Added ${summaryBlocks.length} summary blocks from markdown`);
            } else {
              // Fallback: create a paragraph block
              blockNoteBlocks.push({
                type: "paragraph",
                content: [{ type: "text", text: summary, styles: {} }],
              });
              console.log("✅ Added summary as single paragraph block (fallback)");
            }
          } catch (error) {
            console.error("❌ Error parsing summary markdown:", error);
            // Fallback: create a paragraph block
            blockNoteBlocks.push({
              type: "paragraph",
              content: [{ type: "text", text: summary, styles: {} }],
            });
            console.log("✅ Added summary as single paragraph block (error fallback)");
          }
        }
      }
      // NOTE: topicExplanation blocks are excluded from BlockNote - they're rendered as React components
      // Handle standard BlockNote blocks (paragraph, heading, etc.)
      else if (block.type === "paragraph" || block.type === "heading" || block.type === "bulletListItem" || block.type === "numberedListItem") {
        // Extract text content from the block
        let textContent = "";
        
        if (Array.isArray(block.content) && block.content.length > 0) {
          // Extract text from content array
          textContent = block.content
            .map((item) => {
              if (typeof item === "object" && item !== null && "type" in item) {
                const textItem = item as { type?: string; text?: string };
                if (textItem.type === "text" && textItem.text) {
                  return textItem.text;
                }
              }
              return "";
            })
            .join("")
            .trim();
        } else if (typeof block.content === "string") {
          textContent = block.content.trim();
        }
        
        // For paragraph blocks, always try to parse markdown (BlockNote handles plain text gracefully)
        if (block.type === "paragraph" && textContent) {
          // Parse markdown into blocks - this will handle both markdown and plain text
          try {
            const parsedBlocks = editor.tryParseMarkdownToBlocks(textContent);
            if (parsedBlocks && parsedBlocks.length > 0) {
              blockNoteBlocks.push(...parsedBlocks);
              console.log(`✅ Parsed paragraph into ${parsedBlocks.length} blocks (markdown/plain text)`);
            } else {
              // Fallback: create a paragraph block
              blockNoteBlocks.push({
                type: "paragraph",
                props: {},
                content: [{ type: "text", text: textContent, styles: {} }],
              });
            }
          } catch (error) {
            console.error("❌ Error parsing paragraph markdown:", error);
            // Fallback: create a paragraph block
            blockNoteBlocks.push({
              type: "paragraph",
              props: {},
              content: [{ type: "text", text: textContent, styles: {} }],
            });
          }
        } else if (textContent) {
          // For non-paragraph blocks (headings, lists), use content as-is
          if (Array.isArray(block.content) && block.content.length > 0) {
            const validContent = block.content.filter((item) => {
              if (typeof item === "object" && item !== null && "type" in item) {
                return item.type === "text" && (item as { text?: string }).text?.trim();
              }
              return false;
            });
            
            if (validContent.length > 0) {
              blockNoteBlocks.push({
                type: block.type,
                props: block.props || {},
                content: validContent,
              });
              console.log(`Added ${block.type} block with`, validContent.length, "content items");
            }
          } else {
            blockNoteBlocks.push({
              type: block.type,
              props: block.props || {},
              content: [{ type: "text", text: textContent, styles: {} }],
            });
            console.log(`Added ${block.type} block from string content`);
          }
        }
      }
      // For any other block type, try to extract and convert to paragraph
      else {
        console.warn("Unknown block type:", block.type, "- converting to paragraph");
        // Try to extract text and create a paragraph
        if (Array.isArray(block.content)) {
          const textParts = block.content
            .filter((item) => item && typeof item === "object" && "type" in item && item.type === "text")
            .map((item) => (item as { text?: string }).text)
            .filter((text) => typeof text === "string" && text.trim());
          
          if (textParts.length > 0) {
            blockNoteBlocks.push({
              type: "paragraph",
              content: [{ type: "text", text: textParts.join(" "), styles: {} }],
            });
          }
        }
      }
    }
    
    // Insert blocks directly into editor
    if (blockNoteBlocks.length > 0) {
      console.log(`✅ Prepared ${blockNoteBlocks.length} blocks for insertion`);
      console.log("Block types to insert:", blockNoteBlocks.map((b) => b.type));
      
      try {
        // Get current blocks from editor
        const currentBlocks = editor.topLevelBlocks;
        console.log("Current editor blocks:", currentBlocks.length);
        
        if (currentBlocks.length > 0) {
          // Replace all existing blocks with new content
          try {
            editor.replaceBlocks(editor.document, blockNoteBlocks);
            console.log("✅ Content inserted into editor using replaceBlocks");
            
            // Verify insertion
            const updatedBlocks = editor.topLevelBlocks;
            console.log("Editor now has", updatedBlocks.length, "blocks after insertion");
            console.log("Block types:", updatedBlocks.map((b) => b.type));
            
            // Force re-render
            setEditorKey((prev) => prev + 1);
          } catch (replaceError) {
            console.error("❌ Error in replaceBlocks:", replaceError);
            // Fallback: try inserting before first block and removing old ones
            try {
              editor.insertBlocks(blockNoteBlocks, currentBlocks[0], "before");
              editor.removeBlocks(currentBlocks);
              setEditorKey((prev) => prev + 1);
              console.log("✅ Content inserted using insertBlocks + removeBlocks");
            } catch (insertError) {
              console.error("❌ Error in insertBlocks fallback:", insertError);
            }
          }
        } else {
          console.warn("⚠️ No current blocks in editor to replace");
        }
      } catch (error) {
        console.error("❌ Error inserting blocks:", error);
      }
    } else {
      console.warn("⚠️ No blocks to insert after conversion");
    }
  }, [editor, blocks]); // Run when editor or blocks change

  // Manual save function
  const handleSave = useCallback(async () => {
    if (!editor || !chatId) return;

    try {
      setIsSaving(true);
      const currentBlocks = editor.topLevelBlocks;
      await saveNotebookBlocksAction({
        chatId,
        blocks: currentBlocks,
      });
      if (onBlocksChange) {
        onBlocksChange(currentBlocks);
      }
    } catch (error) {
      console.error("Failed to save notebook blocks:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editor, chatId, onBlocksChange]);

  if (isLoading) {
    return (
      <div className="w-full rounded-lg border border-border bg-background p-4">
        <div className="text-muted-foreground">Loading notebook...</div>
      </div>
    );
  }

  if (!editor) {
    return (
      <div className="w-full rounded-lg border border-border bg-background p-4">
        <div className="text-muted-foreground">Initializing editor...</div>
      </div>
    );
  }

  // Debug: Check if editor has content
  if (process.env.NODE_ENV === "development") {
    const editorBlocks = editor.topLevelBlocks;
    console.log("Editor has", editorBlocks.length, "blocks");
    if (editorBlocks.length > 0) {
      console.log("First block:", editorBlocks[0]);
    }
  }

  // Render blocks in order: topic blocks (React) + standard blocks (BlockNote)
  // For now, render topic blocks above BlockNote editor
  // TODO: Interleave them properly for seamless flow
  return (
    <div className="w-full min-h-[200px] space-y-4">
      {/* Save indicator */}
      {isSaving && (
        <div className="text-xs text-muted-foreground">Saving...</div>
      )}
      
      {/* Topic blocks (React components) - DISABLED in Edit Mode */}
      {/* Edit Mode should only show saved content, not topic structure */}
      {/* Topic blocks are only for Agent Mode or legacy synthesized content */}
      {false && topicBlocks && topicBlocks.length > 0 && (
        <div className="space-y-2">
          {topicBlocks.map((block) => {
            const props = (block.props || {}) as { topicId?: string };
            const key = block.id || props.topicId || "";
            const depth = topicDepths ? (topicDepths.get(key) || 0) : 0;
            return (
              <TopicBlockRenderer
                key={block.id || props.topicId || `topic-${Math.random()}`}
                block={block}
                editor={editor}
                chatId={chatId}
                documentIds={extractedDocInfo.documentIds}
                documentTitle={extractedDocInfo.documentTitle}
                depth={depth}
                allBlocks={blocks} // Pass all blocks for hierarchy lookup
                onUpdate={handleBlockUpdate}
              />
            );
          })}
        </div>
      )}
      
      {/* Standard blocks (BlockNote editor) */}
      {standardBlocks && standardBlocks.length > 0 && (
        <div className="w-full min-h-[200px] rounded-lg border border-border bg-background">
          {editor && (
            <BlockNoteView
              key={editorKey}
              editor={editor}
              editable={editable}
              theme={theme === "dark" ? "dark" : "light"}
            />
          )}
        </div>
      )}
      
      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="w-full min-h-[200px] rounded-lg border border-border bg-background p-8 text-center text-muted-foreground">
          No content yet. Start by uploading a document or asking a question.
        </div>
      )}
    </div>
  );
}

