import { useCallback, useEffect, useState } from "react";
import type { SavedTip } from "@/components/tips-collection";

const TIPS_STORAGE_KEY = "learning_tips";

export function useTips() {
  const [tips, setTips] = useState<SavedTip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load tips from localStorage on mount
  useEffect(() => {
    try {
      const storedTips = localStorage.getItem(TIPS_STORAGE_KEY);
      if (storedTips) {
        const parsedTips = JSON.parse(storedTips);
        setTips(parsedTips);
      }
    } catch (error) {
      console.error("Error loading tips from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save tips to localStorage whenever tips change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(tips));
      } catch (error) {
        console.error("Error saving tips to localStorage:", error);
      }
    }
  }, [tips, isLoading]);

  const addTip = useCallback((text: string, source?: string, note?: string) => {
    const newTip: SavedTip = {
      id: `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      source,
      timestamp: Date.now(),
      color: "#fef08a", // Default yellow highlight
      note,
    };

    setTips((prevTips) => [newTip, ...prevTips]);
    return newTip.id;
  }, []);

  const deleteTip = useCallback((id: string) => {
    setTips((prevTips) => prevTips.filter((tip) => tip.id !== id));
  }, []);

  const updateTip = useCallback((id: string, updates: Partial<SavedTip>) => {
    setTips((prevTips) =>
      prevTips.map((tip) => (tip.id === id ? { ...tip, ...updates } : tip))
    );
  }, []);

  const clearAllTips = useCallback(() => {
    setTips([]);
  }, []);

  const getTipsBySource = useCallback(
    (source: string) => {
      return tips.filter((tip) => tip.source === source);
    },
    [tips]
  );

  const searchTips = useCallback(
    (query: string) => {
      const lowercaseQuery = query.toLowerCase();
      return tips.filter(
        (tip) =>
          tip.text.toLowerCase().includes(lowercaseQuery) ||
          tip.source?.toLowerCase().includes(lowercaseQuery) ||
          tip.note?.toLowerCase().includes(lowercaseQuery)
      );
    },
    [tips]
  );

  return {
    tips,
    isLoading,
    addTip,
    deleteTip,
    updateTip,
    clearAllTips,
    getTipsBySource,
    searchTips,
  };
}
