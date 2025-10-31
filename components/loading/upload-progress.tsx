"use client";

import { motion } from "framer-motion";
import { CheckCircle, FileText, Upload } from "lucide-react";

type UploadProgressProps = {
  progress: number;
  fileName?: string;
  status?: "uploading" | "processing" | "complete";
  message?: string;
};

export function UploadProgress({
  progress,
  fileName,
  status = "uploading",
  message,
}: UploadProgressProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "complete":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "processing":
        return <FileText className="h-5 w-5 text-blue-500" />;
      default:
        return <Upload className="h-5 w-5 text-indigo-500" />;
    }
  };

  const getStatusMessage = () => {
    if (message) return message;

    switch (status) {
      case "complete":
        return "Upload complete! Processing your document...";
      case "processing":
        return "Analyzing your document...";
      default:
        return "Uploading your file...";
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case "complete":
        return "from-green-500 to-green-600";
      case "processing":
        return "from-blue-500 to-blue-600";
      default:
        return "from-indigo-500 to-purple-500";
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
    >
      <div className="mb-3 flex items-center space-x-3">
        <motion.div
          animate={{
            rotate: status === "processing" ? 360 : 0,
            scale: status === "complete" ? [1, 1.2, 1] : 1,
          }}
          transition={{
            rotate: {
              repeat: status === "processing" ? Number.POSITIVE_INFINITY : 0,
              duration: 1,
              ease: "linear",
            },
            scale: {
              duration: 0.3,
              times: [0, 0.5, 1],
            },
          }}
        >
          {getStatusIcon()}
        </motion.div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
            {fileName || "Your file"}
          </p>
          <p className="text-gray-500 text-xs dark:text-gray-400">
            {getStatusMessage()}
          </p>
        </div>

        <span className="font-medium text-gray-500 text-sm dark:text-gray-400">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <motion.div
          animate={{ width: `${progress}%` }}
          className={`h-full bg-gradient-to-r ${getProgressColor()}`}
          initial={{ width: 0 }}
          transition={{ ease: "easeOut", duration: 0.4 }}
        />
      </div>

      {/* Processing Steps */}
      {status === "processing" && (
        <motion.div
          animate={{ opacity: 1 }}
          className="mt-3 space-y-1"
          initial={{ opacity: 0 }}
        >
          {[
            "Extracting text...",
            "Analyzing content...",
            "Generating insights...",
            "Preparing for chat...",
          ].map((step, index) => (
            <motion.div
              animate={{
                opacity: progress > (index + 1) * 25 ? 1 : 0.5,
                color:
                  progress > (index + 1) * 25
                    ? "rgb(34, 197, 94)"
                    : "rgb(107, 114, 128)",
              }}
              className="flex items-center space-x-2 text-xs"
              initial={{ opacity: 0.5 }}
              key={step}
            >
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  progress > (index + 1) * 25
                    ? "bg-green-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
              <span>{step}</span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

