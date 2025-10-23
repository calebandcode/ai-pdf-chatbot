"use client";

import {
  ArrowRight,
  MessageSquare,
  RotateCcw,
  SkipForward,
  Square,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { handleTutorCommand } from "@/app/actions/tutor-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TutorCommandsProps = {
  chatId: string;
  topicId: string;
  subtopicId?: string;
  onCommandExecuted?: () => void;
};

export function TutorCommands({
  chatId,
  topicId,
  subtopicId,
  onCommandExecuted,
}: TutorCommandsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleCommand = async (
    command: "skip" | "repeat" | "next" | "stop"
  ) => {
    setIsLoading(command);

    try {
      await handleTutorCommand({
        chatId,
        command,
        topicId,
        subtopicId,
      });

      // Trigger message refresh
      window.dispatchEvent(
        new CustomEvent("refresh-messages", { detail: { chatId } })
      );

      toast.success(`Command executed: ${command}`);
      onCommandExecuted?.();
    } catch (error) {
      console.error(`Failed to execute ${command} command:`, error);
      toast.error(`Failed to execute ${command} command`);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-purple-800 text-sm">
            Tutor Commands
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="border-purple-300 text-purple-700 hover:bg-purple-100"
            disabled={isLoading === "repeat"}
            onClick={() => handleCommand("repeat")}
            size="sm"
            variant="outline"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            {isLoading === "repeat" ? "..." : "Repeat"}
          </Button>

          <Button
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
            disabled={isLoading === "next"}
            onClick={() => handleCommand("next")}
            size="sm"
            variant="outline"
          >
            <ArrowRight className="mr-1 h-3 w-3" />
            {isLoading === "next" ? "..." : "Next"}
          </Button>

          <Button
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
            disabled={isLoading === "skip"}
            onClick={() => handleCommand("skip")}
            size="sm"
            variant="outline"
          >
            <SkipForward className="mr-1 h-3 w-3" />
            {isLoading === "skip" ? "..." : "Skip"}
          </Button>

          <Button
            className="border-red-300 text-red-700 hover:bg-red-100"
            disabled={isLoading === "stop"}
            onClick={() => handleCommand("stop")}
            size="sm"
            variant="outline"
          >
            <Square className="mr-1 h-3 w-3" />
            {isLoading === "stop" ? "..." : "Stop"}
          </Button>
        </div>

        <p className="mt-2 text-muted-foreground text-xs">
          Use these commands to control your learning session
        </p>
      </CardContent>
    </Card>
  );
}
