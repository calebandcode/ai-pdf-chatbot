"use client";

import { BookOpen, Edit } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ViewMode = "agent" | "edit";

type ModeToggleProps = {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  className?: string;
};

export function ModeToggle({ mode, onModeChange, className }: ModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1",
        className
      )}
    >
      <button
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          mode === "agent"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        onClick={() => onModeChange("agent")}
        type="button"
      >
        <BookOpen className="size-4" />
        <span>Agent</span>
      </button>
      <button
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          mode === "edit"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        onClick={() => onModeChange("edit")}
        type="button"
      >
        <Edit className="size-4" />
        <span>Edit</span>
      </button>
    </div>
  );
}







