"use client";

import { type ComponentProps, memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { StreamingText } from "@/components/streaming/typing-text";

type ResponseProps = ComponentProps<typeof Streamdown> & {
  isStreaming?: boolean;
  speed?: number;
  onComplete?: () => void;
};

export const Response = memo(
  ({ className, isStreaming = false, speed = 15, onComplete, children, ...props }: ResponseProps) => {
    const [hasAnimated, setHasAnimated] = useState(false);

    // Reset animation state when content changes significantly
    useEffect(() => {
      if (isStreaming && children) {
        setHasAnimated(false);
      }
    }, [isStreaming, children]);

    const handleAnimationComplete = () => {
      setHasAnimated(true);
      onComplete?.();
    };

    // Always show streaming animation when isStreaming is true and we haven't animated yet
    if (isStreaming && !hasAnimated) {
      return (
        <motion.div 
          className={cn("size-full", className)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <StreamingText
            text={String(children || "")}
            isStreaming={true}
            speed={speed}
            onComplete={handleAnimationComplete}
            className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto"
          />
        </motion.div>
      );
    }

    // Show normal content when not streaming or animation is complete
    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
          className
        )}
        {...props}
      >
        {children}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => {
    // Always re-render if streaming status changes
    if (prevProps.isStreaming !== nextProps.isStreaming) {
      return false;
    }
    return prevProps.children === nextProps.children;
  }
);

Response.displayName = "Response";
