"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Brain, Clock, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

export type SavedTip = {
  id: string;
  text: string;
  source?: string;
  timestamp: number;
  color?: string;
  note?: string;
};

type TipsCollectionProps = {
  isOpen: boolean;
  onClose: () => void;
  tips: SavedTip[];
  onDeleteTip: (id: string) => void;
  onQuizFromTip: (text: string) => void;
};

export function TipsCollection({
  isOpen,
  onClose,
  tips,
  onDeleteTip,
  onQuizFromTip,
}: TipsCollectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTips, setFilteredTips] = useState<SavedTip[]>(tips);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTips(tips);
    } else {
      const filtered = tips.filter(
        (tip) =>
          tip.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tip.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tip.note?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTips(filtered);
    }
  }, [searchQuery, tips]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      return "Just now";
    }
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
    return date.toLocaleDateString();
  };

  const getSourceIcon = (source?: string) => {
    if (!source) {
      return <BookOpen className="h-4 w-4" />;
    }
    if (source.includes("pdf")) {
      return <BookOpen className="h-4 w-4" />;
    }
    if (source.includes("http")) {
      return <BookOpen className="h-4 w-4" />;
    }
    return <BookOpen className="h-4 w-4" />;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          animate={{ scale: 1, opacity: 1 }}
          className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800"
          exit={{ scale: 0.9, opacity: 0 }}
          initial={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-gray-200 border-b p-4 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-xl">My Learning Tips</h2>
              <Badge variant="secondary">{tips.length} saved</Badge>
            </div>
            <Button onClick={onClose} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4">
            <div className="relative mb-4">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
              <Input
                className="pl-10"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your tips..."
                value={searchQuery}
              />
            </div>

            <div className="max-h-96 space-y-3 overflow-y-auto">
              {filteredTips.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  {searchQuery
                    ? "No tips match your search"
                    : "No tips saved yet"}
                </div>
              ) : (
                filteredTips.map((tip) => (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="group"
                    exit={{ opacity: 0, y: -10 }}
                    initial={{ opacity: 0, y: 10 }}
                    key={tip.id}
                  >
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              {getSourceIcon(tip.source)}
                              <span className="text-gray-500 text-sm">
                                {tip.source || "Unknown source"}
                              </span>
                              <Badge className="text-xs" variant="outline">
                                <Clock className="mr-1 h-3 w-3" />
                                {formatDate(tip.timestamp)}
                              </Badge>
                            </div>

                            <p className="mb-2 text-gray-800 dark:text-gray-200">
                              {tip.text}
                            </p>

                            {tip.note && (
                              <div className="rounded bg-yellow-50 p-2 text-gray-700 text-sm dark:bg-yellow-900/20 dark:text-gray-300">
                                <strong>Note:</strong> {tip.note}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              className="h-8 w-8 p-0"
                              onClick={() => onQuizFromTip(tip.text)}
                              size="sm"
                              title="Quiz me on this"
                              variant="ghost"
                            >
                              <Brain className="h-4 w-4" />
                            </Button>
                            <Button
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                              onClick={() => onDeleteTip(tip.id)}
                              size="sm"
                              title="Delete tip"
                              variant="ghost"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
