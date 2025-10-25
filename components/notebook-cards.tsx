"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Calendar, FileText, Play, TrendingUp, MoreHorizontalIcon, ShareIcon, TrashIcon, LockIcon, GlobeIcon } from "lucide-react";
import useSWRInfinite from "swr/infinite";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/utils";
import type { Chat } from "@/lib/db/schema";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { CheckCircleFillIcon } from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

import { getChatHistoryPaginationKey } from "./sidebar-history";

// Notebook Card Component
function NotebookCard({ chat, onDelete }: { chat: Chat; onDelete: (chatId: string) => void }) {
  const router = useRouter();
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return formatDate(dateString);
  };

  // Use chat title directly (same as sidebar)
  const documentTitle = chat.title || "Untitled Document";
  
  // Leave summary empty for clean look
  const summary = "";

  console.log("Chat data:", { chat, documentTitle });

  const handleClick = () => {
    router.push(`/chat/${chat.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-sm border border-gray-100 bg-white p-4 transition-all duration-200 hover:border-gray-200 cursor-pointer"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-14">
        <div className="flex items-center gap-2">
          <div className="rounded-sm bg-gray-50 p-1">
            <BookOpen className="h-3 w-3 text-gray-600" />
          </div>
          <div>
            <h3 className="font-normal text-gray-900 text-sm group-hover:text-gray-700 transition-colors line-clamp-1">
              {documentTitle}
            </h3>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar className="h-2.5 w-2.5" />
              <span>{formatDate(chat.createdAt)}</span>
            </div>
          </div>
        </div>
        
        {/* Context Menu */}
        <DropdownMenu modal={true}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-60 transition-opacity text-gray-400 hover:text-gray-600"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon className="h-3 w-3" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <ShareIcon />
                <span>Share</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    className="cursor-pointer flex-row justify-between"
                    onClick={() => {
                      setVisibilityType("private");
                    }}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <LockIcon size={12} />
                      <span>Private</span>
                    </div>
                    {visibilityType === "private" ? (
                      <CheckCircleFillIcon />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex-row justify-between"
                    onClick={() => {
                      setVisibilityType("public");
                    }}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <GlobeIcon />
                      <span>Public</span>
                    </div>
                    {visibilityType === "public" ? <CheckCircleFillIcon /> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
              onSelect={() => onDelete(chat.id)}
            >
              <TrashIcon />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Preview Content */}
      <div className="mb-3">
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
          {summary}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300">
          {formatLastActivity(chat.createdAt)}
        </span>
        <div className="text-xs text-gray-400 font-normal group-hover:text-gray-500">
          Continue →
        </div>
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 rounded-sm bg-gradient-to-r from-gray-50/0 to-gray-50/0 group-hover:from-gray-50/20 group-hover:to-gray-50/5 transition-all duration-200 pointer-events-none" />
    </motion.div>
  );
}

export function NotebookCards() {
  const {
    data,
    error,
    isLoading,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    revalidateFirstPage: false,
  });

  const chats = data ? data.flatMap((page) => page.chats) : [];
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);

  console.log("NotebookCards debug:", { data, error, isLoading, chats });

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }

      // Refresh the data
      window.location.reload();
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  if (error) {
    console.error("NotebookCards error:", error);
    return (
      <div className="p-4 text-center text-sm text-red-500">
        Failed to load notebooks
      </div>
    );
  }

  if (isLoading) {
    console.log("NotebookCards loading...");
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      </div>
    );
  }

  if (chats.length === 0) {
    console.log("NotebookCards: No chats found");
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No notebooks yet. Upload a document to get started!
      </div>
    );
  }

  console.log("NotebookCards: Rendering", chats.length, "chats");

  return (
    <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {chats.map((chat, index) => (
        <motion.div
          key={chat.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <NotebookCard chat={chat} onDelete={handleDeleteChat} />
        </motion.div>
      ))}
    </div>
  );
}
