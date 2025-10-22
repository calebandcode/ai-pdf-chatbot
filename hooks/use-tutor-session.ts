"use client";

import { useEffect, useState } from "react";
import type { TutorSessionState } from "@/app/actions/tutor-session";

const TUTOR_SESSION_KEY = "tutor:session";

export function useTutorSession(chatId: string) {
  const [sessionState, setSessionState] = useState<TutorSessionState | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load session from sessionStorage on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const stored = sessionStorage.getItem(`${TUTOR_SESSION_KEY}:${chatId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as TutorSessionState;
          setSessionState(parsed);
        }
      } catch (error) {
        console.error(
          "Failed to load tutor session from sessionStorage:",
          error
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [chatId]);

  // Save session to sessionStorage
  const saveSession = (state: TutorSessionState) => {
    try {
      sessionStorage.setItem(
        `${TUTOR_SESSION_KEY}:${chatId}`,
        JSON.stringify(state)
      );
      setSessionState(state);
    } catch (error) {
      console.error("Failed to save tutor session to sessionStorage:", error);
    }
  };

  // Clear session
  const clearSession = () => {
    try {
      sessionStorage.removeItem(`${TUTOR_SESSION_KEY}:${chatId}`);
      setSessionState(null);
    } catch (error) {
      console.error(
        "Failed to clear tutor session from sessionStorage:",
        error
      );
    }
  };

  // Update session step
  const updateStep = (step: TutorSessionState["step"]) => {
    if (sessionState) {
      const updated = { ...sessionState, step };
      saveSession(updated);
    }
  };

  // Update progress
  const updateProgress = (progress: Partial<TutorSessionState["progress"]>) => {
    if (sessionState) {
      const updated = {
        ...sessionState,
        progress: { ...sessionState.progress, ...progress },
      };
      saveSession(updated);
    }
  };

  // Check if session is active
  const isActive = sessionState && sessionState.step !== "completed";

  return {
    sessionState,
    isLoading,
    saveSession,
    clearSession,
    updateStep,
    updateProgress,
    isActive,
  };
}
