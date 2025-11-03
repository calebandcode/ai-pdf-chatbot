"use client";

import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFont } from "@/contexts/font-context";

type ReadingControlsBarProps = {
  tipsCount?: number;
  onTipsClick?: () => void;
};

export function ReadingControlsBar({
  tipsCount: _tipsCount,
  onTipsClick: _onTipsClick,
}: ReadingControlsBarProps) {
  const { fontFamily, setFontFamily } = useFont();

  const fonts = [
    { value: "inter", label: "Inter" },
    { value: "merriweather", label: "Merriweather" },
    { value: "lora", label: "Lora" },
    { value: "manrope", label: "Manrope" },
    { value: "roboto-mono", label: "Roboto Mono" },
  ] as const;

  return (
    <TooltipProvider>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="fixed right-4 bottom-20 z-40 flex flex-col items-center gap-2 border border-gray-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
      >
        {/* Font Selector */}
        <Tooltip>
          <TooltipTrigger asChild>
            <select
              className="h-8 w-14 border border-gray-200 bg-white px-1.5 text-gray-900 text-xs transition-colors hover:bg-gray-50 focus:border-gray-300 focus:outline-none"
              onChange={(e) =>
                setFontFamily(e.target.value as typeof fontFamily)
              }
              value={fontFamily}
            >
              {fonts.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </TooltipTrigger>
          <TooltipContent>
            <p>Font Family</p>
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </TooltipProvider>
  );
}
