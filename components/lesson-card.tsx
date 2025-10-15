"use client";

import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  FileText,
  Play,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Lesson {
  id: string;
  title: string;
  summary: string;
  keyTerms: string[];
  sourcePages: number[];
  content: string;
  createdAt: Date;
}

interface LessonCardProps {
  lesson: Lesson;
  onStartChatQuiz: (lessonId: string) => void;
  onGenerateArtifactQuiz: (lessonId: string) => void;
  onSaveFlashcards: (lessonId: string) => void;
}

export function LessonCard({
  lesson,
  onStartChatQuiz,
  onGenerateArtifactQuiz,
  onSaveFlashcards,
}: LessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getPageRange = (pages: number[]) => {
    if (pages.length === 0) return "No pages";
    if (pages.length === 1) return `Page ${pages[0]}`;

    const sorted = [...pages].sort((a, b) => a - b);
    const start = sorted[0];
    const end = sorted[sorted.length - 1];

    return start === end ? `Page ${start}` : `Pages ${start}–${end}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">{lesson.title}</CardTitle>
            </div>
            <CardDescription>
              {getPageRange(lesson.sourcePages)} •{" "}
              {formatDate(lesson.createdAt)}
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            size="sm"
            variant="ghost"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div>
            <p className="text-gray-700 text-sm leading-relaxed">
              {lesson.summary}
            </p>
          </div>

          {/* Key Terms */}
          {lesson.keyTerms.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-700 text-sm">
                  Key Terms
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lesson.keyTerms.map((term, index) => (
                  <Badge className="text-xs" key={index} variant="secondary">
                    {term}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Expanded Content */}
          {isExpanded && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium text-gray-700 text-sm">
                  <FileText className="h-4 w-4" />
                  Lesson Content
                </h4>
                <div className="prose prose-sm max-w-none text-gray-600">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {lesson.content}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              className="flex items-center gap-2"
              onClick={() => onStartChatQuiz(lesson.id)}
              size="sm"
            >
              <Play className="h-4 w-4" />
              Start Chat Quiz
            </Button>
            <Button
              className="flex items-center gap-2"
              onClick={() => onGenerateArtifactQuiz(lesson.id)}
              size="sm"
              variant="outline"
            >
              <Brain className="h-4 w-4" />
              Generate Quiz
            </Button>
            <Button
              className="flex items-center gap-2"
              onClick={() => onSaveFlashcards(lesson.id)}
              size="sm"
              variant="outline"
            >
              <BookOpen className="h-4 w-4" />
              Save Flashcards
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
