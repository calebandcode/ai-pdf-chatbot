"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AddSourcePayload =
  | { kind: "pdf"; file: File }
  | { kind: "link"; url: string; title?: string }
  | { kind: "text"; title: string; content: string };

type AddSourceModalProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSubmit: (payload: AddSourcePayload) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
};

const SOURCE_TABS: Array<{ id: "pdf" | "link" | "text"; label: string }> = [
  { id: "pdf", label: "PDF Upload" },
  { id: "link", label: "Website Link" },
  { id: "text", label: "Plain Text" },
];

export function AddSourceModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: AddSourceModalProps) {
  const [activeTab, setActiveTab] = useState<"pdf" | "link" | "text">("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const resetState = () => {
    setActiveTab("pdf");
    setSelectedFile(null);
    setLinkUrl("");
    setLinkTitle("");
    setTextTitle("");
    setTextContent("");
    setLocalError(null);
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      resetState();
    }
    onOpenChange(value);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setLocalError(null);
    }
  };

  const handleSubmit = async () => {
    setLocalError(null);
    if (activeTab === "pdf") {
      if (!selectedFile) {
        setLocalError("Please choose a PDF file to upload.");
        return;
      }
      await onSubmit({ kind: "pdf", file: selectedFile });
      return;
    }

    if (activeTab === "link") {
      if (!linkUrl.trim()) {
        setLocalError("Please provide a valid URL.");
        return;
      }
      await onSubmit({
        kind: "link",
        url: linkUrl.trim(),
        title: linkTitle.trim() || undefined,
      });
      return;
    }

    if (!textTitle.trim() || !textContent.trim()) {
      setLocalError("Title and content are required.");
      return;
    }

    await onSubmit({
      kind: "text",
      title: textTitle.trim(),
      content: textContent.trim(),
    });
  };

  return (
    <AlertDialog onOpenChange={handleClose} open={open}>
      <AlertDialogContent className="max-w-xl gap-4">
        <AlertDialogHeader>
          <AlertDialogTitle>Add a new source</AlertDialogTitle>
          <AlertDialogDescription>
            Bring in another document, link, or note to enrich this chat.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                activeTab === tab.id
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={isSubmitting}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "pdf" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a PDF from your computer. We&apos;ll ingest it and add it
              to this chat&apos;s context.
            </p>
            <Input
              accept="application/pdf"
              disabled={isSubmitting}
              onChange={handleFileChange}
              type="file"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>
        )}

        {activeTab === "link" && (
          <div className="space-y-3">
            <Input
              disabled={isSubmitting}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://example.com/article"
              value={linkUrl}
            />
            <Input
              disabled={isSubmitting}
              onChange={(event) => setLinkTitle(event.target.value)}
              placeholder="Optional title"
              value={linkTitle}
            />
          </div>
        )}

        {activeTab === "text" && (
          <div className="space-y-3">
            <Input
              disabled={isSubmitting}
              onChange={(event) => setTextTitle(event.target.value)}
              placeholder="Give this source a title"
              value={textTitle}
            />
            <Textarea
              className="min-h-[140px]"
              disabled={isSubmitting}
              onChange={(event) => setTextContent(event.target.value)}
              placeholder="Paste your notes or reference text here..."
              value={textContent}
            />
          </div>
        )}

        {(localError || error) && (
          <p className="text-sm text-destructive">{localError ?? error}</p>
        )}

        <AlertDialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => handleClose(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={handleSubmit} type="button">
            {isSubmitting ? "Adding…" : "Add source"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
