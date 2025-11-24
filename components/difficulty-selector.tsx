"use client";

import { GraduationCapIcon, SchoolIcon, UserIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { updateDifficultyLevelAction } from "@/app/actions/update-difficulty";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type DifficultyLevel = "age12" | "age15" | "university";

type DifficultySelectorProps = {
  chatId: string;
  currentDifficulty: DifficultyLevel;
  onDifficultyChange?: (difficulty: DifficultyLevel) => void;
  className?: string;
};

const difficultyConfig: Record<
  DifficultyLevel,
  { label: string; icon: typeof UserIcon; description: string }
> = {
  age12: {
    label: "12",
    icon: UserIcon,
    description: "Explain like I'm 12",
  },
  age15: {
    label: "15",
    icon: SchoolIcon,
    description: "Explain like I'm 15",
  },
  university: {
    label: "Uni",
    icon: GraduationCapIcon,
    description: "University level",
  },
};

export function DifficultySelector({
  chatId,
  currentDifficulty,
  onDifficultyChange,
  className,
}: DifficultySelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDifficultyChange = useCallback(
    async (newDifficulty: DifficultyLevel) => {
      if (newDifficulty === currentDifficulty || isUpdating) {
        return;
      }

      setIsUpdating(true);
      try {
        const result = await updateDifficultyLevelAction({
          chatId,
          difficultyLevel: newDifficulty,
        });

        if (result.success) {
          onDifficultyChange?.(newDifficulty);
          toast.success(`Difficulty set to ${difficultyConfig[newDifficulty].description}`);
        } else {
          toast.error(result.error || "Failed to update difficulty");
        }
      } catch (error) {
        console.error("Failed to update difficulty:", error);
        toast.error("Failed to update difficulty");
      } finally {
        setIsUpdating(false);
      }
    },
    [chatId, currentDifficulty, isUpdating, onDifficultyChange]
  );

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1 ${className ?? ""}`}>
        {(
          ["age12", "age15", "university"] as DifficultyLevel[]
        ).map((level) => {
          const config = difficultyConfig[level];
          const Icon = config.icon;
          const isActive = currentDifficulty === level;

          return (
            <Tooltip key={level}>
              <TooltipTrigger asChild>
                <Button
                  className={`h-8 px-2 text-xs transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  disabled={isUpdating}
                  onClick={() => {
                    handleDifficultyChange(level);
                  }}
                  type="button"
                  variant="ghost"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="ml-1 hidden sm:inline">{config.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}



