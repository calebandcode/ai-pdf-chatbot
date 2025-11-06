"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface TypingTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function TypingText({ 
  text, 
  speed = 20, 
  onComplete, 
  className = "" 
}: TypingTextProps) {
  const [displayed, setDisplayed] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);

  useEffect(() => {
    if (!text) return;
    
    setDisplayed("");
    setIsComplete(false);
    setCurrentChunk(0);
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
        
        // Update chunk for fade effect every 10 characters
        setCurrentChunk(Math.floor(i / 10));
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <motion.span
      initial={{ opacity: 0, y: 5 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        // Add subtle scale effect for chunk-based fading
        scale: currentChunk > 0 ? [1, 1.02, 1] : 1
      }}
      transition={{ 
        duration: 0.4, 
        ease: "easeOut",
        scale: { duration: 0.1, delay: 0 }
      }}
      className={className}
    >
      {displayed}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ 
            repeat: Number.POSITIVE_INFINITY, 
            duration: 0.8,
            ease: "easeInOut"
          }}
          className="ml-0.5 text-blue-500 font-mono"
        >
          |
        </motion.span>
      )}
    </motion.span>
  );
}

interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function StreamingText({ 
  text, 
  isStreaming = false, 
  speed = 20, 
  className = "",
  onComplete 
}: StreamingTextProps) {
  if (!isStreaming) {
    return <span className={className}>{text}</span>;
  }

  return (
    <TypingText 
      text={text} 
      speed={speed} 
      className={className}
      onComplete={onComplete}
    />
  );
}
