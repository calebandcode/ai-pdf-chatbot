"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { StreamingText } from "./typing-text";
import { AIThinking } from "./typing-indicator";
import { Button } from "@/components/ui/button";

export function StreamingDemo() {
  const [isThinking, setIsThinking] = useState(false);
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const demoText = "This is a demonstration of the streaming text animation. Each letter appears gradually, creating a realistic typing effect that makes the AI feel alive and engaging. The text flows in smoothly with subtle fade-in effects and a blinking cursor that disappears when complete.";

  const handleStartDemo = () => {
    setIsThinking(true);
    setResponse("");
    setIsStreaming(false);

    // Show thinking indicator for 2 seconds
    setTimeout(() => {
      setIsThinking(false);
      setIsStreaming(true);
      setResponse(demoText);
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Streaming Text Animation Demo</h2>
        <p className="text-gray-600 mb-6">
          Click the button to see the ChatGPT-style streaming effect in action
        </p>
        <Button onClick={handleStartDemo} disabled={isThinking || isStreaming}>
          {isThinking || isStreaming ? "Demo Running..." : "Start Demo"}
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 min-h-[200px]">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <span className="text-blue-600 text-sm">🤖</span>
          </div>
          
          <div className="flex-1">
            {isThinking ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <AIThinking message="AI is thinking..." />
              </motion.div>
            ) : response ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-gray-800 leading-relaxed"
              >
                <StreamingText
                  text={response}
                  isStreaming={isStreaming}
                  speed={15}
                  onComplete={() => setIsStreaming(false)}
                />
              </motion.div>
            ) : (
              <div className="text-gray-400 italic">
                Click "Start Demo" to see the streaming animation
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-500 space-y-2">
        <h3 className="font-semibold">Features Demonstrated:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>✅ Typing indicator appears first</li>
          <li>✅ Text appears gradually, letter by letter</li>
          <li>✅ Each chunk fades in softly for natural realism</li>
          <li>✅ Blinking cursor during typing</li>
          <li>✅ Smooth fade-in transitions</li>
          <li>✅ Cursor disappears when complete</li>
        </ul>
      </div>
    </div>
  );
}


