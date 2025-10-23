"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  generateSubtopicExplanationAction,
  generateTopicExplanationAction,
} from "@/app/actions/generate-explanations";
import { startGuidedSession } from "@/app/actions/tutor-session";
import { Response } from "@/components/elements/response";
import { Button } from "@/components/ui/button";
import { sanitizeText } from "@/lib/utils";

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
};

export function TopicOutline({
  topics,
  documentIds,
  chatId,
}: TopicOutlineProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Set<string>>(new Set());
  const [topicContent, setTopicContent] = useState<Record<string, string>>({});
  const [subtopicContent, setSubtopicContent] = useState<
    Record<string, string>
  >({});

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
      const result = await generateTopicExplanationAction(
        topicName,
        topic.description,
        topic.pages
      );

      setTopicContent((prev) => ({
        ...prev,
        [topicName]: result.explanation,
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
      const result = await generateSubtopicExplanationAction(
        parentTopic.topic,
        subtopicName,
        subtopicData.pages
      );

      setSubtopicContent((prev) => ({
        ...prev,
        [subtopicName]: result.explanation,
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

  return (
    <div className="prose prose-sm max-w-none">
      <p className="mb-4 text-gray-700 leading-relaxed">
        Here are the main topics covered in your document. Click on any topic to
        explore it further:
      </p>

      {topics.map((topic, index) => {
        const isExpanded = expandedTopics.has(topic.topic);
        const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;

        return (
          <div className="mb-6" key={`topic-${topic.topic}-${index}`}>
            {/* Topic as clickable text */}
            <button
              className="w-full cursor-pointer border-none bg-transparent p-0 text-left transition-colors hover:text-blue-600"
              onClick={() => toggleTopic(topic.topic)}
              type="button"
            >
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-800 text-lg">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {topic.topic}
                <span className="font-normal text-gray-500 text-sm">
                  (pages {formatPages(topic.pages)})
                </span>
              </h3>
            </button>

            {/* Topic Content - Expanded */}
            {isExpanded && (
              <div className="ml-6 space-y-4">
                {/* Auto-generated Explanation */}
                <div>
                  {loadingStates.has(`explain-${topic.topic}`) ? (
                    <div className="mb-3 flex items-center gap-2 text-gray-500 text-sm">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      Generating explanation...
                    </div>
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
                </div>

                {/* Action Buttons - Simplified */}
                <div className="mb-4 flex gap-2">
                  <Button
                    className="h-auto px-3 py-1 text-xs"
                    disabled={loadingStates.has(`guided-${topic.topic}-main`)}
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
                  <Button
                    className="h-auto px-3 py-1 text-xs"
                    disabled={loadingStates.has(`quiz-${topic.topic}`)}
                    onClick={() => handleStartQuiz(topic.topic, topic.pages)}
                    size="sm"
                    variant="outline"
                  >
                    {loadingStates.has(`quiz-${topic.topic}`)
                      ? "Generating..."
                      : "Take Quiz"}
                  </Button>
                </div>

                {/* Subtopics */}
                {isExpanded && hasSubtopics && (
                  <div className="ml-4">
                    <p className="mb-3 font-medium text-gray-600 text-sm">
                      Subtopics:
                    </p>
                    {topic.subtopics?.map((subtopic, subIndex) => (
                      <div
                        className="mb-4"
                        key={`subtopic-${subtopic.subtopic}-${subIndex}`}
                      >
                        {/* Subtopic as clickable text */}
                        <button
                          className="w-full cursor-pointer border-none bg-transparent p-0 text-left transition-colors hover:text-blue-600"
                          onClick={() => toggleSubtopic(subtopic.subtopic)}
                          type="button"
                        >
                          <h4 className="mb-2 flex items-center gap-2 font-medium text-base text-gray-700">
                            {expandedTopics.has(
                              `subtopic-${subtopic.subtopic}`
                            ) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {subtopic.subtopic}
                            <span className="font-normal text-gray-500 text-xs">
                              (pages {formatPages(subtopic.pages)})
                            </span>
                          </h4>
                        </button>

                        {/* Subtopic Content - Expanded */}
                        {expandedTopics.has(
                          `subtopic-${subtopic.subtopic}`
                        ) && (
                          <div className="ml-6 space-y-3">
                            {/* Auto-generated Explanation */}
                            <div>
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
                            </div>

                            {/* Action Buttons - Simplified */}
                            <div className="flex gap-2">
                              <Button
                                className="h-auto px-2 py-1 text-xs"
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
                                className="h-auto px-2 py-1 text-xs"
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
                                {loadingStates.has(`quiz-${subtopic.subtopic}`)
                                  ? "Generating..."
                                  : "Take Quiz"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
