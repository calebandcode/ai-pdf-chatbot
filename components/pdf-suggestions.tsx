"use client";

import { motion } from "framer-motion";
import { BookOpen, Brain, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PDFSuggestionAction {
  id: string;
  type: "quiz_drill" | "generate_quiz" | "flashcards" | "ask_questions";
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

interface PDFSuggestionsProps {
  actions: PDFSuggestionAction[];
  className?: string;
}

export function PDFSuggestions({ actions, className }: PDFSuggestionsProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-wrap gap-2", className)}
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.2 }}
    >
      {actions.map((action) => (
        <motion.div
          key={action.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            className="group relative flex h-auto flex-col items-start gap-2 p-3 text-left transition-all hover:shadow-md"
            onClick={action.action}
            variant="outline"
          >
            <div className="flex w-full items-center gap-2">
              <div className="flex-shrink-0 text-primary group-hover:text-primary/80">
                {action.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{action.label}</div>
                <div className="text-muted-foreground text-xs">
                  {action.description}
                </div>
              </div>
            </div>
          </Button>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Helper function to create PDF suggestion actions
export function createPDFSuggestionActions(
  docId: string,
  chatId: string,
  onAction: (
    type: PDFSuggestionAction["type"],
    documentId: string,
    chatId: string
  ) => void
): PDFSuggestionAction[] {
  return [
    {
      id: "quiz-drill",
      type: "quiz_drill",
      label: "Start Quiz Drill",
      description: "Interactive Q&A with explanations",
      icon: <Zap className="h-4 w-4" />,
      action: () => onAction("quiz_drill", docId, chatId),
    },
    {
      id: "generate-quiz",
      type: "generate_quiz",
      label: "Generate Practice Quiz",
      description: "Create a saved quiz artifact",
      icon: <BookOpen className="h-4 w-4" />,
      action: () => onAction("generate_quiz", docId, chatId),
    },
    {
      id: "flashcards",
      type: "flashcards",
      label: "Create Flashcards",
      description: "Interactive study cards",
      icon: <Brain className="h-4 w-4" />,
      action: () => onAction("flashcards", docId, chatId),
    },
    {
      id: "ask-questions",
      type: "ask_questions",
      label: "Ask Questions",
      description: "Get answers from the document",
      icon: <MessageSquare className="h-4 w-4" />,
      action: () => onAction("ask_questions", docId, chatId),
    },
  ];
}
