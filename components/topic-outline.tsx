"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  Copy,
  HelpCircle,
  MessageCircle,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  generateSubtopicExplanationAction,
  generateTopicExplanationAction,
} from "@/app/actions/generate-explanations";
import { generateUnifiedQuiz } from "@/app/actions/generate-unified-quiz";
import { startGuidedSession } from "@/app/actions/tutor-session";
import { Response } from "@/components/elements/response";
import { Suggestion } from "@/components/elements/suggestion";
import { FloatingBubble } from "@/components/floating-bubble";
import { SkeletonBlock } from "@/components/loading/skeleton-loaders";
import { useBubble } from "@/hooks/use-bubble";
import type {
  DocumentQuizContext,
  SubtopicQuizContext,
  TopicQuizContext,
} from "@/lib/types/quiz";
import { sanitizeText } from "@/lib/utils";

// Loading skeleton component
const LoadingSkeleton = () => (
  <SkeletonBlock
    className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    lines={3}
    variant="text"
  />
);

type Topic = {
  topic: string;
  description?: string;
  pages?: number[];
  subtopics?: Array<{
    subtopic: string;
    description?: string;
    pages?: number[];
  }>;
};

type TopicOutlineProps = {
  topics: Topic[];
  documentIds: string[];
  chatId: string;
  documentTitle?: string;
};

export function TopicOutline({
  topics,
  documentIds,
  chatId,
  documentTitle,
}: TopicOutlineProps) {
  // Persist expanded topics in localStorage
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(`expandedTopics_${chatId}`);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("Failed to load expanded topics from localStorage:", error);
    }
    return new Set();
  });

  // Save expanded topics to localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        `expandedTopics_${chatId}`,
        JSON.stringify(Array.from(expandedTopics))
      );
    } catch (error) {
      console.warn("Failed to save expanded topics to localStorage:", error);
    }
  }, [expandedTopics, chatId]);
  const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());

  // Persist topic explanations in localStorage
  const [topicContent, setTopicContent] = useState<Record<string, string>>(
    () => {
      if (typeof window === "undefined") return {};
      try {
        const stored = localStorage.getItem(`topicContent_${chatId}`);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (error) {
        console.warn("Failed to load topic content from localStorage:", error);
      }
      return {};
    }
  );

  const [subtopicContent, setSubtopicContent] = useState<
    Record<string, string>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(`subtopicContent_${chatId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Failed to load subtopic content from localStorage:", error);
    }
    return {};
  });

  // Save topic content to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        `topicContent_${chatId}`,
        JSON.stringify(topicContent)
      );
    } catch (error) {
      console.warn("Failed to save topic content to localStorage:", error);
    }
  }, [topicContent, chatId]);

  // Save subtopic content to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        `subtopicContent_${chatId}`,
        JSON.stringify(subtopicContent)
      );
    } catch (error) {
      console.warn("Failed to save subtopic content to localStorage:", error);
    }
  }, [subtopicContent, chatId]);
  const [streamedContent, setStreamedContent] = useState<Set<string>>(
    new Set()
  );
  const [conversationContext, setConversationContext] = useState({
    topicsCovered: [] as string[],
    currentIndex: 0,
  });

  // Load explanations from messages on mount and when messages refresh
  useEffect(() => {
    const loadExplanationsFromMessages = async () => {
      try {
        const response = await fetch(`/api/chat/${chatId}/messages`);
        if (!response.ok) return;

        const messages = await response.json();
        const loadedTopicContent: Record<string, string> = {};
        const loadedSubtopicContent: Record<string, string> = {};
        const topicsToExpand = new Set<string>();

        // Extract explanations from messages
        // Messages from API are DBMessage[] format, which has the same structure as ChatMessage
        for (const msg of messages) {
          if (msg.role === "assistant" && Array.isArray(msg.parts)) {
            const topicExplanationPart = msg.parts.find(
              (p: { type?: string }) => p.type === "data-topicExplanation"
            );

            if (topicExplanationPart) {
              const data = (
                topicExplanationPart as {
                  data?: {
                    topicName?: string;
                    isSubtopic?: boolean;
                    parentTopic?: string;
                  };
                }
              ).data;
              const textPart = msg.parts.find(
                (p: { type?: string; text?: string }) => p.type === "text"
              );

              if (data?.topicName && textPart?.text) {
                if (data.isSubtopic) {
                  loadedSubtopicContent[data.topicName] = textPart.text;
                  // Also expand parent topic if subtopic has explanation
                  if (data.parentTopic) {
                    topicsToExpand.add(data.parentTopic);
                  }
                } else {
                  loadedTopicContent[data.topicName] = textPart.text;
                  topicsToExpand.add(data.topicName);
                }
              }
            }
          }
        }

        // Update state with loaded explanations (merge with localStorage data)
        if (Object.keys(loadedTopicContent).length > 0) {
          setTopicContent((prev) => {
            const merged = { ...prev, ...loadedTopicContent };
            // Also save to localStorage immediately
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(
                  `topicContent_${chatId}`,
                  JSON.stringify(merged)
                );
              } catch (error) {
                console.warn(
                  "Failed to save topic content to localStorage:",
                  error
                );
              }
            }
            return merged;
          });
        }
        if (Object.keys(loadedSubtopicContent).length > 0) {
          setSubtopicContent((prev) => {
            const merged = { ...prev, ...loadedSubtopicContent };
            // Also save to localStorage immediately
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(
                  `subtopicContent_${chatId}`,
                  JSON.stringify(merged)
                );
              } catch (error) {
                console.warn(
                  "Failed to save subtopic content to localStorage:",
                  error
                );
              }
            }
            return merged;
          });
        }

        // Auto-expand topics that have explanations
        if (topicsToExpand.size > 0) {
          setExpandedTopics((prev) => {
            const newSet = new Set(prev);
            topicsToExpand.forEach((topic) => newSet.add(topic));
            return newSet;
          });
        }
      } catch (error) {
        console.warn("Failed to load explanations from messages:", error);
      }
    };

    loadExplanationsFromMessages();

    // Also listen for message refresh events
    const handleRefresh = () => {
      loadExplanationsFromMessages();
    };

    window.addEventListener("refresh-messages", handleRefresh);
    return () => {
      window.removeEventListener("refresh-messages", handleRefresh);
    };
  }, [chatId]);

  // Bubble system
  const { isOpen, bubbleData, position, bubbleRef, openBubble, closeBubble } =
    useBubble();

  // Open a whole-document quiz bubble when requested externally
  useEffect(() => {
    const handler = async (e: Event) => {
      try {
        const { detail } = e as CustomEvent<{
          documentIds: string[];
          chatId: string;
        }>;
        const docIds = detail?.documentIds?.length
          ? detail.documentIds
          : documentIds;

        const allPages = Array.from(
          new Set((topics || []).flatMap((t) => t.pages || []))
        ).sort((a, b) => a - b);

        const context: DocumentQuizContext = {
          scope: "document",
          documentIds: docIds,
          chatId,
          documentTitle: documentTitle || "Document",
          allPages,
          allTopics: (topics || []).map((t) => ({
            topic: t.topic,
            description: t.description || "",
            pages: t.pages || [],
            subtopics: t.subtopics?.map((st) => ({
              subtopic: st.subtopic,
              description: (st as { description?: string }).description,
              pages: st.pages || [],
            })),
          })),
          documentSummary: "",
          questionCount: 8,
          difficulty: "mixed",
        };

        const quizResult = await generateUnifiedQuiz(context);

        openBubble({
          type: "quiz",
          title: quizResult.title,
          content: {
            questions: quizResult.questions,
            quizId: quizResult.quizId,
            title: quizResult.title,
          },
          sourceElement: document.body as unknown as HTMLElement,
        });
      } catch (error) {
        console.error("Error generating document quiz:", error);
        toast.error("Failed to generate practice quiz. Please try again.");
      }
    };

    window.addEventListener("open-document-quiz", handler as EventListener);
    return () => {
      window.removeEventListener(
        "open-document-quiz",
        handler as EventListener
      );
    };
  }, [chatId, documentIds, documentTitle, openBubble, topics]);

  // Text selection handlers
  const handleHighlight = (_text: string, _range: Range) => {
    console.log("Highlighting text:", _text);
    // The highlighting is already handled in the TextSelectionBubble component
  };

  const handleQuizBubble = async (
    event: React.MouseEvent | { currentTarget: HTMLElement },
    topic: string,
    pages: number[]
  ) => {
    // Handle both real events and mock events
    if (
      "stopPropagation" in event &&
      typeof event.stopPropagation === "function"
    ) {
      event.stopPropagation();
    }
    const element = event.currentTarget as HTMLElement;

    try {
      // Generate content if not available
      let content = topicContent[topic];
      if (!content) {
        console.log("🔄 Generating topic content for quiz...");
        const result = await generateTopicExplanationAction({
          topicName: topic,
          description: topics.find((t) => t.topic === topic)?.description || "",
          pages,
          documentTitle,
          previousTopics: conversationContext.topicsCovered,
          currentIndex: conversationContext.currentIndex,
          totalTopics: topics.length,
          documentIds,
        });
        content = result.explanation;
        // Update state for future use
        setTopicContent((prev) => ({
          ...prev,
          [topic]: content,
        }));
      }

      // Create topic quiz context
      const context: TopicQuizContext = {
        scope: "topic",
        topicName: topic,
        topicPages: pages,
        allSubtopics: (
          topics.find((t) => t.topic === topic)?.subtopics || []
        ).map((st) => ({
          subtopic: st.subtopic,
          pages: st.pages || [],
        })),
        topicContent: content,
        rawContent: "", // Will be fetched by the action
        questionCount: 5,
        difficulty: "mixed",
        documentIds,
        chatId,
        documentTitle, // Add document title for language context
      };

      // Generate quiz using unified system
      const quizResult = await generateUnifiedQuiz(context);

      openBubble({
        type: "quiz",
        title: quizResult.title,
        content: {
          questions: quizResult.questions,
          quizId: quizResult.quizId,
          title: quizResult.title,
        },
        sourceElement: element,
      });
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Failed to generate quiz. Please try again.");
    }
  };

  const handleSubtopicQuizBubble = async (
    event: React.MouseEvent,
    subtopic: string,
    pages: number[],
    parentTopic: string
  ) => {
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;

    try {
      // Generate content if not available
      let content = subtopicContent[subtopic];
      if (!content) {
        console.log("🔄 Generating subtopic content for quiz...");
        const result = await generateSubtopicExplanationAction({
          parentTopic,
          subtopicName: subtopic,
          pages,
          documentTitle,
          previousTopics: conversationContext.topicsCovered,
          currentIndex: conversationContext.currentIndex,
          totalTopics: topics.length,
          documentIds,
          chatId, // Pass chatId to save explanation as message
        });
        content = result.explanation;
        // Update state for future use
        setSubtopicContent((prev) => ({
          ...prev,
          [subtopic]: content,
        }));

        // Trigger message refresh so Edit Mode can see the new explanation
        window.dispatchEvent(
          new CustomEvent("refresh-messages", { detail: { chatId } })
        );
      }

      // Create subtopic quiz context
      const context: SubtopicQuizContext = {
        scope: "subtopic",
        subtopicName: subtopic,
        subtopicPages: pages,
        parentTopicName: parentTopic,
        subtopicContent: content,
        rawContent: "", // Will be fetched by the action
        questionCount: 3,
        difficulty: "easy-medium",
        documentIds,
        chatId,
        conversationContext: {
          topicsCovered: conversationContext.topicsCovered,
          currentIndex: conversationContext.currentIndex,
          totalTopics: topics.length,
        },
        documentTitle, // Add document title for language context
      };

      // Generate quiz using unified system
      const quizResult = await generateUnifiedQuiz(context);

      openBubble({
        type: "quiz",
        title: quizResult.title,
        content: {
          questions: quizResult.questions,
          quizId: quizResult.quizId,
          title: quizResult.title,
        },
        sourceElement: element,
      });
    } catch (error) {
      console.error("Error generating subtopic quiz:", error);
      toast.error("Failed to generate quiz. Please try again.");
    }
  };

  const handleLearnMoreBubble = (
    event: React.MouseEvent,
    topic: string,
    pages: number[]
  ) => {
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;

    openBubble({
      type: "learn-more",
      title: `Learn More: ${topic}`,
      content: {
        topic,
        content: topicContent[topic] || "Loading additional information...",
        sourcePage: pages[0] || 1,
        pages,
        relatedTopics: topics
          .filter((t) => t.topic !== topic)
          .slice(0, 3)
          .map((t) => t.topic),
        sources:
          pages.length > 0
            ? `${pages.length} references`
            : "No sources available",
      },
      sourceElement: element,
    });
  };

  const handleSaveBubble = (
    event: React.MouseEvent,
    topic: string,
    pages: number[]
  ) => {
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;

    openBubble({
      type: "save",
      title: `Save: ${topic}`,
      content: {
        topic,
        content: topicContent[topic] || "No content available",
        sourcePage: pages[0] || 1,
      },
      sourceElement: element,
    });
  };

  const handleCopyTopic = async (_topic: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Topic content copied to clipboard!");
    } catch (_error) {
      toast.error("Failed to copy content");
    }
  };

  const toggleTopic = async (topicName: string) => {
    const newExpanded = new Set(expandedTopics);
    const isExpanding = !newExpanded.has(topicName);

    if (isExpanding) {
      newExpanded.add(topicName);
      // Only auto-generate explanation if not already loaded
      if (!topicContent[topicName]) {
        await generateTopicExplanation(topicName);
      }
    } else {
      newExpanded.delete(topicName);
    }
    setExpandedTopics(newExpanded);
  };

  const toggleSubtopic = async (subtopicName: string) => {
    const newExpanded = new Set(expandedTopics);
    const isExpanding = !newExpanded.has(`subtopic-${subtopicName}`);

    if (isExpanding) {
      newExpanded.add(`subtopic-${subtopicName}`);
      // Only auto-generate explanation if not already loaded
      if (!subtopicContent[subtopicName]) {
        await generateSubtopicExplanation(subtopicName);
      }
    } else {
      newExpanded.delete(`subtopic-${subtopicName}`);
    }
    setExpandedTopics(newExpanded);
  };

  const generateTopicExplanation = async (topicName: string) => {
    // Check if content already exists to prevent unnecessary API calls
    if (topicContent[topicName]) {
      return;
    }

    const key = `explain-${topicName}`;
    setLoadingStates((prev) => new Set(prev).add(key));

    try {
      // Find the topic data
      const topic = topics.find((t) => t.topic === topicName);
      if (!topic) {
        return;
      }

      // Generate explanation using server action
      const result = await generateTopicExplanationAction({
        topicName,
        description: topic.description,
        pages: topic.pages,
        documentTitle,
        previousTopics: conversationContext.topicsCovered,
        currentIndex: conversationContext.currentIndex,
        totalTopics: topics.length,
        documentIds,
        chatId, // Pass chatId to save explanation as message
      });

      setTopicContent((prev) => ({
        ...prev,
        [topicName]: result.explanation,
      }));

      // Mark as newly generated for streaming animation
      setStreamedContent((prev) => new Set(prev).add(`topic-${topicName}`));

      // Trigger message refresh so Edit Mode can see the new explanation
      window.dispatchEvent(
        new CustomEvent("refresh-messages", { detail: { chatId } })
      );

      // Update conversation context
      setConversationContext((prev) => ({
        topicsCovered: [...prev.topicsCovered, topicName],
        currentIndex: prev.currentIndex + 1,
      }));
    } catch (error) {
      console.error("Failed to generate topic explanation:", error);
      setTopicContent((prev) => ({
        ...prev,
        [topicName]: "Failed to generate explanation. Please try again.",
      }));
    } finally {
      setLoadingStates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const generateSubtopicExplanation = async (subtopicName: string) => {
    // Check if content already exists to prevent unnecessary API calls
    if (subtopicContent[subtopicName]) {
      return;
    }

    const key = `explain-${subtopicName}`;
    setLoadingStates((prev) => new Set(prev).add(key));

    try {
      // Find the subtopic data
      let subtopicData: { subtopic: string; pages: number[] } | null = null;
      let parentTopic: {
        topic: string;
        description: string;
        pages: number[];
      } | null = null;

      for (const topic of topics) {
        if (topic.subtopics) {
          const found = topic.subtopics.find(
            (s) => s.subtopic === subtopicName
          );
          if (found) {
            subtopicData = found;
            parentTopic = topic;
            break;
          }
        }
      }

      if (!subtopicData || !parentTopic) {
        return;
      }

      // Generate explanation using server action
      const result = await generateSubtopicExplanationAction({
        parentTopic: parentTopic.topic,
        subtopicName,
        description: subtopicData.description, // Pass subtopic description
        pages: subtopicData.pages,
        documentTitle,
        previousTopics: conversationContext.topicsCovered,
        currentIndex: conversationContext.currentIndex,
        totalTopics: topics.length,
        documentIds,
        chatId, // Pass chatId to save explanation as message
      });

      setSubtopicContent((prev) => ({
        ...prev,
        [subtopicName]: result.explanation,
      }));

      // Mark as streamed for first-time animation
      setStreamedContent((prev) =>
        new Set(prev).add(`subtopic-${subtopicName}`)
      );

      // Trigger message refresh so Edit Mode can see the new explanation
      window.dispatchEvent(
        new CustomEvent("refresh-messages", { detail: { chatId } })
      );

      // Update conversation context for subtopics
      setConversationContext((prev) => ({
        topicsCovered: [
          ...prev.topicsCovered,
          `${parentTopic.topic} - ${subtopicName}`,
        ],
        currentIndex: prev.currentIndex + 1,
      }));
    } catch (error) {
      console.error("Failed to generate subtopic explanation:", error);
      setSubtopicContent((prev) => ({
        ...prev,
        [subtopicName]: "Failed to generate explanation. Please try again.",
      }));
    } finally {
      setLoadingStates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const _handleStartGuidedLesson = async (
    topic: string,
    subtopic?: string,
    pages?: number[]
  ) => {
    const key = `guided-${topic}-${subtopic || "main"}`;
    setLoadingStates((prev) => new Set(prev).add(key));

    try {
      await startGuidedSession({
        chatId,
        documentIds,
        topic,
        subtopic,
        pages,
      });

      // Trigger message refresh
      window.dispatchEvent(
        new CustomEvent("refresh-messages", { detail: { chatId } })
      );

      toast.success(`🎓 Guided lesson started for "${topic}"!`);
    } catch (error) {
      console.error("Failed to start guided lesson:", error);
      toast.error("Failed to start guided lesson. Please try again.");
    } finally {
      setLoadingStates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const _handleStartQuiz = async (subtopic: string, _pages: number[]) => {
    const key = `quiz-${subtopic}`;
    setLoadingStates((prev) => new Set(prev).add(key));

    try {
      // Import the quiz generation function
      const { startChatQuiz } = await import("@/app/actions/chat-quiz");

      await startChatQuiz({
        chatId,
        documentIds,
        title: `Quiz: ${subtopic}`,
      });

      // Trigger message refresh
      window.dispatchEvent(
        new CustomEvent("refresh-messages", { detail: { chatId } })
      );

      toast.success(`🧠 Quiz started for "${subtopic}"!`);
    } catch (error) {
      console.error("Failed to start quiz:", error);
      toast.error("Failed to start quiz. Please try again.");
    } finally {
      setLoadingStates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const formatPages = (pages: number[]) => {
    if (pages.length === 1) {
      return `Page ${pages[0]}`;
    }
    if (pages.length <= 3) {
      return `Pages ${pages.join(", ")}`;
    }
    return `Pages ${pages[0]}-${pages.at(-1)}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (_error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const _shareContent = async (text: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
        });
      } catch (_error) {
        // User cancelled or error occurred
      }
    } else {
      // Fallback to copy
      await copyToClipboard(text, title);
    }
  };

  return (
    <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
      {/* Subtle divider - no formal header */}
      <div className="mb-8 border-gray-100 border-b pb-6" />

      {topics.map((topic, index) => {
        const isExpanded = expandedTopics.has(topic.topic);
        const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;

        return (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
            initial={{ opacity: 0, y: 10 }}
            key={`topic-${topic.topic}-${index}`}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            {/* Topic Header - Story-like Style with Subtle Background */}
            <div
              className="group rounded-lg border border-transparent bg-gray-50/50 p-4 transition-all duration-200 hover:border-gray-200 hover:bg-gray-50"
              data-topic={topic.topic}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left side - Topic info */}
                <div className="min-w-0 flex-1">
                  <button
                    className="w-full cursor-pointer border-none bg-transparent p-0 text-left transition-colors hover:text-blue-600"
                    onClick={() => toggleTopic(topic.topic)}
                    type="button"
                  >
                    <div className="flex items-start gap-3">
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        className="mt-1 flex-shrink-0"
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-2 font-medium text-gray-900 text-lg">
                          {topic.topic}
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {topic.description}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-gray-500 text-xs">
                          <BookOpen className="h-3 w-3" />
                          <span>
                            {topic.pages.length} reference
                            {topic.pages.length !== 1 ? "s" : ""} •{" "}
                            {formatPages(topic.pages)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Right side - Topic action buttons */}
                <div className="flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Learn More button */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 transition-colors hover:bg-green-200"
                        data-bubble-trigger
                        onClick={(e) =>
                          handleLearnMoreBubble(e, topic.topic, topic.pages)
                        }
                        title="Learn more"
                        type="button"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </motion.div>

                    {/* Take Quiz button */}
                    <div className="flex justify-end">
                      <Suggestion
                        onClick={() => {
                          const mockEvent = {
                            currentTarget: document.querySelector(
                              `[data-topic="${topic.topic}"]`
                            ) as HTMLElement,
                          };
                          handleQuizBubble(mockEvent, topic.topic, topic.pages);
                        }}
                        suggestion="Take Quiz"
                      >
                        <HelpCircle className="mr-0.5 h-4 w-4" />
                        Quiz
                      </Suggestion>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Topic Content - Expanded with Animation */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                  exit={{ opacity: 0, height: 0 }}
                  initial={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                  <div className="relative ml-6 space-y-4 pt-4 pl-4">
                    {/* Curved connection to subtopics - starts from topic level */}
                    {hasSubtopics && (
                      <div className="-left-2 absolute top-16 h-8 w-2 rounded-bl-lg bg-gradient-to-br from-gray-200 to-gray-100" />
                    )}
                    {/* Conversational Introduction to Content */}
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4"
                      initial={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-gray-600 text-sm">
                        Here's what that means in simpler terms:
                      </p>
                    </motion.div>

                    {/* Auto-generated Explanation */}
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      initial={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3 }}
                    >
                      {loadingStates.has(`explain-${topic.topic}`) ? (
                        <LoadingSkeleton />
                      ) : topicContent[topic.topic] ? (
                        <div className="mb-4">
                          <Response
                            isStreaming={streamedContent.has(
                              `topic-${topic.topic}`
                            )}
                            onComplete={() => {
                              // Mark as no longer streaming after animation completes
                              setStreamedContent((prev) => {
                                const newSet = new Set(prev);
                                newSet.delete(`topic-${topic.topic}`);
                                return newSet;
                              });
                            }}
                            speed={20}
                          >
                            {sanitizeText(topicContent[topic.topic])}
                          </Response>
                        </div>
                      ) : (
                        <p className="mb-3 text-gray-500 text-sm">
                          Click to expand and generate explanation
                        </p>
                      )}
                    </motion.div>

                    {/* Subtopics - Conversational Introduction */}
                    {isExpanded && hasSubtopics && (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-5 ml-4"
                        initial={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3 }}
                      >
                        <p className="mb-4 font-medium text-gray-600 text-sm">
                          Let's break this down further:
                        </p>
                        {topic.subtopics?.map((subtopic, subIndex) => (
                          <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4"
                            data-subtopic={subtopic.subtopic}
                            initial={{ opacity: 0, y: -5 }}
                            key={`subtopic-${subtopic.subtopic}-${subIndex}`}
                            transition={{ duration: 0.3 }}
                          >
                            {/* Subtopic as clickable text */}
                            <div className="relative border-gray-100 border-b pb-2">
                              {/* Curved left border that connects to the divider */}
                              <div className="-left-6 absolute top-0 h-full w-6">
                                <svg
                                  className="absolute inset-0 h-full w-full"
                                  preserveAspectRatio="none"
                                  viewBox="0 0 24 100"
                                >
                                  <path
                                    d="M0,0 Q0,6 6,6 L18,6 Q24,6 24,12 L24,88 Q24,94 18,94 L6,94 Q0,94 0,100"
                                    fill="none"
                                    stroke="rgb(243 244 246)"
                                    strokeWidth="1"
                                  />
                                </svg>
                                <div
                                  className="absolute bottom-0 left-0 h-px w-6 bg-gray-100"
                                  style={{ borderRadius: "0 0 0 4px" }}
                                />
                              </div>
                              <button
                                className="w-full cursor-pointer border-none bg-transparent p-0 text-left transition-colors hover:text-blue-600"
                                onClick={() =>
                                  toggleSubtopic(subtopic.subtopic)
                                }
                                type="button"
                              >
                                <h4 className="mb-2 flex items-center gap-2 font-medium text-base text-gray-700">
                                  <motion.div
                                    animate={{
                                      rotate: expandedTopics.has(
                                        `subtopic-${subtopic.subtopic}`
                                      )
                                        ? 90
                                        : 0,
                                    }}
                                    className="transition-transform duration-300"
                                    transition={{
                                      duration: 0.3,
                                      ease: "easeInOut",
                                    }}
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </motion.div>
                                  <span className="flex-1">
                                    {subtopic.subtopic}
                                  </span>
                                  <span className="flex-shrink-0 font-normal text-gray-500 text-xs">
                                    (pages {formatPages(subtopic.pages)})
                                  </span>
                                </h4>
                              </button>
                            </div>

                            {/* Subtopic Content - Expanded */}
                            <AnimatePresence>
                              {expandedTopics.has(
                                `subtopic-${subtopic.subtopic}`
                              ) && (
                                <motion.div
                                  animate={{ opacity: 1, y: 0 }}
                                  className="relative ml-6 space-y-3 pl-4"
                                  exit={{ opacity: 0, y: -5 }}
                                  initial={{ opacity: 0, y: -5 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  {/* Curved left border for subtopic content */}
                                  <div className="-left-6 absolute top-0 bottom-0 w-6">
                                    <svg
                                      className="absolute inset-0 h-full w-full"
                                      preserveAspectRatio="none"
                                      viewBox="0 0 24 100"
                                    >
                                      <path
                                        d="M0,0 Q0,6 6,6 L18,6 Q24,6 24,12 L24,88 Q24,94 18,94 L6,94 Q0,94 0,100"
                                        fill="none"
                                        stroke="rgb(243 244 246)"
                                        strokeWidth="1"
                                      />
                                    </svg>
                                  </div>
                                  {/* Conversational Introduction */}
                                  <motion.p
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-gray-600 text-sm"
                                    initial={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    Here's the breakdown:
                                  </motion.p>

                                  {/* Auto-generated Explanation */}
                                  <motion.div
                                    animate={{ opacity: 1, y: 0 }}
                                    initial={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    {loadingStates.has(
                                      `explain-${subtopic.subtopic}`
                                    ) ? (
                                      <div className="mb-2 flex items-center gap-2 text-gray-500 text-sm">
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                        Generating explanation...
                                      </div>
                                    ) : subtopicContent[subtopic.subtopic] ? (
                                      <div className="mb-3">
                                        <Response
                                          isStreaming={streamedContent.has(
                                            `subtopic-${subtopic.subtopic}`
                                          )}
                                          onComplete={() => {
                                            // Mark as no longer streaming after animation completes
                                            setStreamedContent((prev) => {
                                              const newSet = new Set(prev);
                                              newSet.delete(
                                                `subtopic-${subtopic.subtopic}`
                                              );
                                              return newSet;
                                            });
                                          }}
                                          speed={20}
                                        >
                                          {sanitizeText(
                                            subtopicContent[subtopic.subtopic]
                                          )}
                                        </Response>
                                      </div>
                                    ) : (
                                      <p className="mb-2 text-gray-500 text-sm">
                                        Click to expand and generate explanation
                                      </p>
                                    )}
                                  </motion.div>

                                  {/* Sources Information */}
                                  <motion.div
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-2"
                                    initial={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                                      <BookOpen className="h-3 w-3" />
                                      <span className="font-medium">
                                        Sources:
                                      </span>
                                      <span className="text-gray-500">
                                        {subtopic.pages.length} reference
                                        {subtopic.pages.length !== 1 ? "s" : ""}{" "}
                                        • {formatPages(subtopic.pages)}
                                      </span>
                                    </div>
                                  </motion.div>

                                  {/* Action Buttons - Natural Positioning */}
                                  {subtopicContent[subtopic.subtopic] && (
                                    <div className="flex items-center justify-end">
                                      {/* Right side - Quiz */}
                                      <div className="flex gap-2">
                                        <Suggestion
                                          className="h-auto whitespace-normal p-3 text-left"
                                          onClick={() => {
                                            // Create a mock event for positioning
                                            const mockEvent = {
                                              currentTarget:
                                                (document.querySelector(
                                                  `[data-subtopic="${subtopic.subtopic}"]`
                                                ) as HTMLElement) ||
                                                document.body,
                                              stopPropagation: () => {
                                                // Mock stopPropagation for positioning
                                              },
                                            } as unknown as React.MouseEvent;

                                            handleSubtopicQuizBubble(
                                              mockEvent,
                                              subtopic.subtopic,
                                              subtopic.pages,
                                              topic.topic
                                            );
                                          }}
                                          suggestion="Test Understanding"
                                        >
                                          <HelpCircle className="mr-0.5 h-4 w-4" />
                                          Test Understanding
                                        </Suggestion>
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Floating Bubble System */}
      <FloatingBubble
        bubbleData={bubbleData}
        isOpen={isOpen}
        onClose={closeBubble}
        position={position}
        ref={bubbleRef}
      />

      {/* Selection and contextual chat tools are hidden in the game-focused pivot */}
    </div>
  );
}
