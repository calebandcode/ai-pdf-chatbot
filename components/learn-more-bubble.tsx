"use client";

import { BookOpen, Check, Save } from "lucide-react";
import { useState } from "react";

type LearnMoreBubbleProps = {
  data: {
    topic: string;
    content: string;
    sourcePage: number;
    pages?: number[];
    relatedTopics?: string[];
    sources?: string;
  };
  onClose: () => void;
};

export function LearnMoreBubble({ data, onClose }: LearnMoreBubbleProps) {
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    // TODO: Implement save functionality
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="rounded-lg bg-blue-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-blue-800 text-sm">
            {data.topic}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-blue-700 text-xs">
            Source: Page {data.sourcePage}
            {data.pages && data.pages.length > 1 && ` (Pages ${data.pages.join(', ')})`}
          </p>
          {data.sources && (
            <p className="text-blue-600 text-xs font-medium">
              {data.sources}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none">
        <div className="text-gray-700 text-sm leading-relaxed">
          {data.content}
        </div>
      </div>

      {/* Related topics */}
      {data.relatedTopics && data.relatedTopics.length > 0 && (
        <div>
          <h5 className="mb-2 font-medium text-gray-800 text-sm">
            Related Topics:
          </h5>
          <div className="flex flex-wrap gap-2">
            {data.relatedTopics.map((topic) => (
              <span
                className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 text-xs"
                key={topic}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors ${
            isSaved
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          onClick={handleSave}
          type="button"
        >
          {isSaved ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Note
            </>
          )}
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
