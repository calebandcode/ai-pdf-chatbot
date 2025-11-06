"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

type LoadingState = {
  isLoading: boolean;
  message: string;
  type: "default" | "ai" | "analysis";
  showProgress: boolean;
  progress: number;
  variant?: "chat" | "analysis" | "processing";
};

type LoadingActions = {
  setLoading: (loading: boolean, message?: string, type?: "default" | "ai" | "analysis") => void;
  setProgress: (progress: number) => void;
  setMessage: (message: string) => void;
  setType: (type: "default" | "ai" | "analysis") => void;
  setVariant: (variant: "chat" | "analysis" | "processing") => void;
  reset: () => void;
};

const initialState: LoadingState = {
  isLoading: false,
  message: "",
  type: "default",
  showProgress: false,
  progress: 0,
  variant: "chat",
};

export const useLoading = create<LoadingState & LoadingActions>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setLoading: (loading, message = "", type = "default") => {
        set({
          isLoading: loading,
          message: message || (loading ? "Loading..." : ""),
          type,
          showProgress: false,
          progress: loading ? 0 : 100,
        });
      },
      
      setProgress: (progress) => {
        set({ progress: Math.max(0, Math.min(100, progress)) });
      },
      
      setMessage: (message) => {
        set({ message });
      },
      
      setType: (type) => {
        set({ type });
      },
      
      setVariant: (variant) => {
        set({ variant });
      },
      
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "loading-store",
    }
  )
);

// Convenience hooks for common loading patterns
export const useAILoading = () => {
  const { setLoading, setMessage, setType } = useLoading();
  
  return {
    startThinking: (message = "Thinking...") => {
      setType("ai");
      setLoading(true, message);
    },
    startAnalysis: (message = "Analyzing...") => {
      setType("analysis");
      setLoading(true, message);
    },
    stop: () => setLoading(false),
    updateMessage: setMessage,
  };
};

export const useUploadProgress = () => {
  const { setLoading, setProgress, setMessage, setType } = useLoading();
  
  return {
    startUpload: (fileName: string) => {
      setType("default");
      setLoading(true, `Uploading ${fileName}...`);
      setProgress(0);
    },
    updateProgress: (progress: number) => {
      setProgress(progress);
    },
    setProcessing: (message = "Processing your document...") => {
      setMessage(message);
      setType("analysis");
    },
    complete: () => {
      setLoading(false);
    },
  };
};

