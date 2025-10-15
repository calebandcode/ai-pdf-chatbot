"use client";

import { AlertCircle, CheckCircle, FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { uploadAndIngest } from "@/app/actions/upload-and-ingest";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface UploadResult {
  documentId: string;
  title: string;
  blobUrl: string;
  chunksInserted: number;
  summary?: string;
  suggestedActions?: string[];
  pageCount?: number;
}

export function PDFTutorUpload() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const pdfFiles = files.filter((file) => file.type === "application/pdf");

      if (pdfFiles.length === 0) {
        toast.error("Please select PDF files only");
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        pdfFiles.forEach((file) => {
          formData.append("files", file);
        });

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const result = await uploadAndIngest(formData);

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (result.documents && result.documents.length > 0) {
          setUploadResults(result.documents);

          // Auto-redirect to chat with the first document
          const firstDoc = result.documents[0];
          if (firstDoc.documentId) {
            setTimeout(() => {
              router.push(
                `/chat?doc=${firstDoc.documentId}&summary=${encodeURIComponent(firstDoc.summary || "")}`
              );
            }, 1000);
          }
        }
      } catch (error) {
        console.error("Upload failed:", error);
        toast.error("Failed to upload PDF. Please try again.");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [router]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(Array.from(e.dataTransfer.files));
      }
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files));
      }
    },
    [handleFiles]
  );

  if (uploadResults.length > 0) {
    return (
      <div className="space-y-4">
        {uploadResults.map((result) => (
          <Card
            className="border-green-200 bg-green-50"
            key={result.documentId}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <CardTitle className="text-green-800">{result.title}</CardTitle>
              </div>
              <CardDescription>
                {result.pageCount} pages • {result.chunksInserted} chunks
                processed
              </CardDescription>
            </CardHeader>
            {result.summary && (
              <CardContent>
                <div className="space-y-3">
                  <p className="text-gray-700 text-sm">{result.summary}</p>
                  {result.suggestedActions && (
                    <div className="flex flex-wrap gap-2">
                      {result.suggestedActions.map((action, index) => (
                        <Button
                          className="text-xs"
                          key={index}
                          size="sm"
                          variant="outline"
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        <div className="text-center text-gray-600 text-sm">
          Redirecting to chat...
        </div>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <FileText className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Upload PDF to Start Learning</CardTitle>
        <CardDescription>
          Drop your PDF here and the AI tutor will read it and start a chat
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Input
            accept=".pdf"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            disabled={isUploading}
            multiple
            onChange={handleFileInput}
            type="file"
          />

          {isUploading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
              </div>
              <div className="space-y-2">
                <p className="font-medium text-sm">Processing your PDF...</p>
                <Progress
                  className="mx-auto w-full max-w-xs"
                  value={uploadProgress}
                />
                <p className="text-gray-500 text-xs">
                  Extracting text, generating summary, and preparing for chat
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 text-lg">
                  Drop PDF files here
                </p>
                <p className="text-gray-500 text-sm">
                  or click to browse files
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                <AlertCircle className="h-4 w-4" />
                <span>PDF files only</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
