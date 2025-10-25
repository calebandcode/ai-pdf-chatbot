"use client";

import { Check, FileText, Save } from "lucide-react";
import { useState } from "react";

type SaveBubbleProps = {
  data: {
    topic: string;
    content: string;
    sourcePage: number;
    notes?: string;
  };
  onClose: () => void;
};

export function SaveBubble({ data, onClose }: SaveBubbleProps) {
  const [notes, setNotes] = useState(data.notes || "");
  const [isSaved, setIsSaved] = useState(false);
  const [saveType, setSaveType] = useState<"summary" | "notes" | "highlight">(
    "summary"
  );

  const handleSave = () => {
    // TODO: Implement save functionality based on saveType
    console.log("Saving:", { topic: data.topic, notes, saveType });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Save type selector */}
      <div>
        <h4 className="mb-3 font-medium text-gray-800 text-sm">
          What would you like to save?
        </h4>
        <div className="space-y-2">
          {[
            { id: "summary", label: "Topic Summary", icon: FileText },
            { id: "notes", label: "Personal Notes", icon: Save },
            { id: "highlight", label: "Key Points", icon: Check },
          ].map(({ id, label, icon: Icon }) => (
            <button
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                saveType === id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
              key={id}
              onClick={() => setSaveType(id as any)}
              type="button"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <span className="font-medium text-sm">{label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content preview */}
      <div className="rounded-lg bg-gray-50 p-3">
        <h5 className="mb-2 font-medium text-gray-800 text-sm">{data.topic}</h5>
        <p className="text-gray-600 text-xs leading-relaxed">
          {data.content.substring(0, 150)}
          {data.content.length > 150 && "..."}
        </p>
        <p className="mt-2 text-gray-500 text-xs">
          Source: Page {data.sourcePage}
        </p>
      </div>

      {/* Notes input (for personal notes) */}
      {saveType === "notes" && (
        <div>
          <label
            className="mb-2 block font-medium text-gray-800 text-sm"
            htmlFor="notes-textarea"
          >
            Your Notes:
          </label>
          <textarea
            className="w-full resize-none rounded-lg border border-gray-200 p-3 text-gray-700 text-sm focus:border-blue-500 focus:outline-none"
            id="notes-textarea"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your personal notes about this topic..."
            rows={4}
            value={notes}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors ${
            isSaved
              ? "bg-green-100 text-green-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
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
              Save{" "}
              {saveType === "summary"
                ? "Summary"
                : saveType === "notes"
                  ? "Notes"
                  : "Highlights"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
