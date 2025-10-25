"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  Copy,
  HelpCircle,
  Save,
  Share,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  generateSubtopicExplanationAction,
  generateTopicExplanationAction,
} from "@/app/actions/generate-explanations";
import { startGuidedSession } from "@/app/actions/tutor-session";
import { Response } from "@/components/elements/response";
import { FloatingBubble } from "@/components/floating-bubble";
import { Button } from "@/components/ui/button";
import { useBubble } from "@/hooks/use-bubble";
import { sanitizeText } from "@/lib/utils";

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="space-y-3">
    <div className="h-4 animate-pulse rounded bg-gray-200" />
    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
    <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
  </div>
);

type Topic = {
  topic: string;
  description: string;
  pages: number[];
  subtopics?: Array<{
    subtopic: string;
    pages: number[];
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
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());
  const [topicContent, setTopicContent] = useState<Record<string, string>>({});
  const [subtopicContent, setSubtopicContent] = useState<
    Record<string, string>
  >({});
  const [conversationContext, setConversationContext] = useState({
    topicsCovered: [] as string[],
    currentIndex: 0,
  });

  // Bubble system
  const { isOpen, bubbleData, position, bubbleRef, openBubble, closeBubble } =
    useBubble();

  const handleQuizBubble = (
    event: React.MouseEvent,
    topic: string,
    pages: number[]
  ) => {
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;

    openBubble({
      type: "quiz",
      title: `Quiz: ${topic}`,
      content: {
        questions: [
          {
            id: `${topic}-q1`,
            prompt: `What is the main concept discussed in "${topic}"?`,
            options: [
              { id: "A", label: "A", text: "Basic introduction" },
              { id: "B", label: "B", text: "Advanced techniques" },
              { id: "C", label: "C", text: "Practical applications" },
              { id: "D", label: "D", text: "Historical context" },
            ],
            correct: "A",
            explanation:
              "This topic covers the fundamental concepts and basic introduction.",
            sourcePage: pages[0] || 1,
            difficulty: "easy",
          },
        ],
        quizId: `quiz-${topic}-${Date.now()}`,
        title: `Quiz: ${topic}`,
      },
      sourceElement: element,
    });
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
        relatedTopics: topics
          .filter((t) => t.topic !== topic)
          .slice(0, 3)
          .map((t) => t.topic),
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
      });

      setTopicContent((prev) => ({
        ...prev,
        [topicName]: result.explanation,
      }));

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
        pages: subtopicData.pages,
        documentTitle,
        previousTopics: conversationContext.topicsCovered,
        currentIndex: conversationContext.currentIndex,
        totalTopics: topics.length,
      });

      setSubtopicContent((prev) => ({
        ...prev,
        [subtopicName]: result.explanation,
      }));

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

  const handleStartGuidedLesson = async (
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

  const handleStartQuiz = async (subtopic: string, _pages: number[]) => {
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

  const shareContent = async (text: string, title: string) => {
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
            <div className="group rounded-lg border border-transparent bg-gray-50/50 p-4 transition-all duration-200 hover:border-gray-200 hover:bg-gray-50">
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

                {/* Right side - Action buttons */}
                <div className="flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Quiz button */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-colors hover:bg-blue-200"
                        data-bubble-trigger
                        onClick={(e) =>
                          handleQuizBubble(e, topic.topic, topic.pages)
                        }
                        type="button"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </motion.div>

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
                        type="button"
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                    </motion.div>

                    {/* Save button */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 transition-colors hover:bg-purple-200"
                        data-bubble-trigger
                        onClick={(e) =>
                          handleSaveBubble(e, topic.topic, topic.pages)
                        }
                        type="button"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    </motion.div>
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
                          <Response>
                            {sanitizeText(topicContent[topic.topic])}
                          </Response>
                        </div>
                      ) : (
                        <p className="mb-3 text-gray-500 text-sm">
                          Click to expand and generate explanation
                        </p>
                      )}
                    </motion.div>

                    {/* Sources Information - Conversational */}
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-3"
                      initial={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <BookOpen className="h-4 w-4" />
                        <span className="font-medium">Sources:</span>
                        <span className="text-gray-500">
                          {topic.pages.length} reference
                          {topic.pages.length !== 1 ? "s" : ""} •{" "}
                          {formatPages(topic.pages)}
                        </span>
                      </div>
                    </motion.div>

                    {/* Action Buttons - Conversational Positioning */}
                    {topicContent[topic.topic] && (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between"
                        initial={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* Learning Actions - Left */}
                        <div className="flex gap-2">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              className="h-8 px-3 py-1 text-xs"
                              disabled={loadingStates.has(
                                `guided-${topic.topic}-main`
                              )}
                              onClick={() =>
                                handleStartGuidedLesson(
                                  topic.topic,
                                  undefined,
                                  topic.pages
                                )
                              }
                              size="sm"
                              variant="outline"
                            >
                              {loadingStates.has(`guided-${topic.topic}-main`)
                                ? "Starting..."
                                : "Start Guided Lesson"}
                            </Button>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              className="h-8 px-3 py-1 text-xs"
                              disabled={loadingStates.has(
                                `quiz-${topic.topic}`
                              )}
                              onClick={() =>
                                handleStartQuiz(topic.topic, topic.pages)
                              }
                              size="sm"
                              variant="outline"
                            >
                              {loadingStates.has(`quiz-${topic.topic}`)
                                ? "Generating..."
                                : "Take Quiz"}
                            </Button>
                          </motion.div>
                        </div>

                        {/* Content Actions - Right */}
                        <div className="flex gap-2">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              className="h-7 px-2 py-1 text-xs"
                              onClick={() =>
                                copyToClipboard(
                                  topicContent[topic.topic],
                                  `${topic.topic} explanation`
                                )
                              }
                              size="sm"
                              variant="outline"
                            >
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </Button>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              className="h-7 px-2 py-1 text-xs"
                              onClick={() =>
                                shareContent(
                                  topicContent[topic.topic],
                                  `${topic.topic} explanation`
                                )
                              }
                              size="sm"
                              variant="outline"
                            >
                              <Share className="mr-1 h-3 w-3" />
                              Share
                            </Button>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}

                    {/* Subtopics - Conversational Introduction */}
                    {isExpanded && hasSubtopics && (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="ml-4"
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
                                        <Response>
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
                                    <motion.div
                                      animate={{ opacity: 1, y: 0 }}
                                      className="flex items-center justify-between"
                                      initial={{ opacity: 0, y: -5 }}
                                      transition={{ duration: 0.3 }}
                                    >
                                      {/* Learning Actions - Left */}
                                      <div className="flex gap-2">
                                        <Button
                                          className="h-7 px-2 py-1 text-xs"
                                          disabled={loadingStates.has(
                                            `guided-${topic.topic}-${subtopic.subtopic}`
                                          )}
                                          onClick={() =>
                                            handleStartGuidedLesson(
                                              topic.topic,
                                              subtopic.subtopic,
                                              subtopic.pages
                                            )
                                          }
                                          size="sm"
                                          variant="outline"
                                        >
                                          {loadingStates.has(
                                            `guided-${topic.topic}-${subtopic.subtopic}`
                                          )
                                            ? "Starting..."
                                            : "Start Guided Lesson"}
                                        </Button>
                                        <Button
                                          className="h-7 px-2 py-1 text-xs"
                                          disabled={loadingStates.has(
                                            `quiz-${subtopic.subtopic}`
                                          )}
                                          onClick={() =>
                                            handleStartQuiz(
                                              subtopic.subtopic,
                                              subtopic.pages
                                            )
                                          }
                                          size="sm"
                                          variant="outline"
                                        >
                                          {loadingStates.has(
                                            `quiz-${subtopic.subtopic}`
                                          )
                                            ? "Generating..."
                                            : "Take Quiz"}
                                        </Button>
                                      </div>

                                      {/* Content Actions - Right */}
                                      <div className="flex gap-1">
                                        <Button
                                          className="h-6 px-2 py-1 text-xs"
                                          onClick={() =>
                                            copyToClipboard(
                                              subtopicContent[
                                                subtopic.subtopic
                                              ],
                                              `${subtopic.subtopic} explanation`
                                            )
                                          }
                                          size="sm"
                                          variant="outline"
                                        >
                                          <Copy className="mr-1 h-3 w-3" />
                                          Copy
                                        </Button>
                                        <Button
                                          className="h-6 px-2 py-1 text-xs"
                                          onClick={() =>
                                            shareContent(
                                              subtopicContent[
                                                subtopic.subtopic
                                              ],
                                              `${subtopic.subtopic} explanation`
                                            )
                                          }
                                          size="sm"
                                          variant="outline"
                                        >
                                          <Share className="mr-1 h-3 w-3" />
                                          Share
                                        </Button>
                                      </div>
                                    </motion.div>
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
    </div>
  );
}
