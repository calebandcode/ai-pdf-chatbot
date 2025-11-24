"use client";

import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModeToggle, type ViewMode } from "@/components/mode-toggle";

type ReadingControlsBarProps = {
  tipsCount?: number;
  onTipsClick?: () => void;
  mode?: ViewMode;
  onModeChange?: (mode: ViewMode) => void;
  hasContent?: boolean;
};

export function ReadingControlsBar({
  tipsCount: _tipsCount,
  onTipsClick: _onTipsClick,
  mode,
  onModeChange,
  hasContent = false,
}: ReadingControlsBarProps) {
  // Edit Mode toggle is disabled in the game-focused pivot
  return null;
}
