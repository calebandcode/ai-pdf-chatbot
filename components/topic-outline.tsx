"use client";

import { ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  generateSubtopicExplanationAction,
  generateTopicExplanationAction,
} from "@/app/actions/generate-explanations";
import { startGuidedSession } from "@/app/actions/tutor-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      // Auto-generate explanation if not already loaded
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
      // Auto-generate explanation if not already loaded
      if (!subtopicContent[subtopicName]) {
        await generateSubtopicExplanation(subtopicName);
      }
    } else {
      newExpanded.delete(`subtopic-${subtopicName}`);
    }
    setExpandedTopics(newExpanded);
  };

  const generateTopicExplanation = async (topicName: string) => {
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

  const handleStartQuiz = async (subtopic: string, pages: number[]) => {
    const key = `quiz-${subtopic}`;
    setLoadingStates((prev) => new Set(prev).add(key));

    try {
      // Import the quiz generation function
      const { startChatQuiz } = await import("@/app/actions/chat-quiz");

      await startChatQuiz({
        chatId,
        documentIds,
        title: `Quiz: ${subtopic}`,
        pages, // Focus on specific pages for this subtopic
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
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-semibold text-lg">
          <GraduationCap className="h-5 w-5 text-blue-600" />
          Document Topics & Structure
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Click on topics to explore subtopics and get explanations
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {topics.map((topic, index) => {
          const isExpanded = expandedTopics.has(topic.topic);
          const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;

          return (
            <div className="space-y-2" key={`topic-${topic.topic}-${index}`}>
              {/* Main Topic */}
              <div className="rounded-lg border bg-muted/20">
                {/* Topic Header - Clickable to expand */}
                <button
                  className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
                  onClick={() => toggleTopic(topic.topic)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{topic.topic}</h3>
                    <Badge className="text-xs" variant="outline">
                      {formatPages(topic.pages)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Topic Content - Expanded */}
                {isExpanded && (
                  <div className="space-y-4 border-t bg-muted/20 p-4">
                    {/* Auto-generated Explanation */}
                    <div>
                      <h5 className="mb-2 font-medium text-muted-foreground text-sm">
                        📚 Explanation
                      </h5>
                      {loadingStates.has(`explain-${topic.topic}`) ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                          Generating explanation...
                        </div>
                      ) : topicContent[topic.topic] ? (
                        <div className="prose prose-sm max-w-none">
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {topicContent[topic.topic]}
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Click to expand and generate explanation
                        </p>
                      )}
                    </div>

                    {/* Action Buttons - Consolidated */}
                    <div className="flex gap-2">
                      <Button
                        className="border-purple-300 text-purple-700 hover:bg-purple-50"
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
                        <GraduationCap className="mr-1 h-3 w-3" />
                        {loadingStates.has(`guided-${topic.topic}-main`)
                          ? "Starting..."
                          : "🎓 Start Guided Lesson"}
                      </Button>

                      <Button
                        className="border-orange-300 text-orange-700 hover:bg-orange-100"
                        disabled={loadingStates.has(`quiz-${topic.topic}`)}
                        onClick={() =>
                          handleStartQuiz(topic.topic, topic.pages)
                        }
                        size="sm"
                        variant="outline"
                      >
                        <GraduationCap className="mr-1 h-3 w-3" />
                        {loadingStates.has(`quiz-${topic.topic}`)
                          ? "Generating..."
                          : "🧠 Take Quiz"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Subtopics */}
                {isExpanded && hasSubtopics && (
                  <div className="space-y-2 border-t bg-muted/10 p-4">
                    <h5 className="mb-3 font-medium text-muted-foreground text-sm">
                      📚 Subtopics
                    </h5>
                    {topic.subtopics?.map((subtopic, subIndex) => (
                      <div
                        className="rounded-lg border bg-background"
                        key={`subtopic-${subtopic.subtopic}-${subIndex}`}
                      >
                        {/* Subtopic Header - Clickable to expand */}
                        <button
                          className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
                          onClick={() => toggleSubtopic(subtopic.subtopic)}
                          type="button"
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">
                              {subtopic.subtopic}
                            </h4>
                            <Badge className="text-xs" variant="secondary">
                              {formatPages(subtopic.pages)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {expandedTopics.has(
                              `subtopic-${subtopic.subtopic}`
                            ) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* Subtopic Content - Expanded */}
                        {expandedTopics.has(
                          `subtopic-${subtopic.subtopic}`
                        ) && (
                          <div className="space-y-4 border-t bg-muted/20 p-4">
                            {/* Auto-generated Explanation */}
                            <div>
                              <h5 className="mb-2 font-medium text-muted-foreground text-sm">
                                📚 Explanation
                              </h5>
                              {loadingStates.has(
                                `explain-${subtopic.subtopic}`
                              ) ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                  Generating explanation...
                                </div>
                              ) : subtopicContent[subtopic.subtopic] ? (
                                <div className="prose prose-sm max-w-none">
                                  <p className="text-gray-700 text-sm leading-relaxed">
                                    {subtopicContent[subtopic.subtopic]}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  Click to expand and generate explanation
                                </p>
                              )}
                            </div>

                            {/* Action Buttons - Consolidated */}
                            <div className="flex gap-2">
                              <Button
                                className="border-purple-300 text-purple-700 hover:bg-purple-50"
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
                                <GraduationCap className="mr-1 h-3 w-3" />
                                {loadingStates.has(
                                  `guided-${topic.topic}-${subtopic.subtopic}`
                                )
                                  ? "Starting..."
                                  : "🎓 Start Guided Lesson"}
                              </Button>

                              <Button
                                className="border-orange-300 text-orange-700 hover:bg-orange-100"
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
                                <GraduationCap className="mr-1 h-3 w-3" />
                                {loadingStates.has(`quiz-${subtopic.subtopic}`)
                                  ? "Generating..."
                                  : "🧠 Take Quiz"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
