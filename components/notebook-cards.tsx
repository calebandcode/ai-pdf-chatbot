"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/components/ui/button";
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
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Chat } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { CheckCircleFillIcon } from "./icons";

type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

import { getChatHistoryPaginationKey } from "./sidebar-history";

// Notebook Card Component
function NotebookCard({
  chat,
  onDelete,
}: {
  chat: Chat;
  onDelete: (chatId: string) => void;
}) {
  const router = useRouter();
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });

  const formatDate = (dateInput: string | Date) => {
    const date = new Date(dateInput);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatLastActivity = (dateInput: string | Date) => {
    const date = new Date(dateInput);
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
    return formatDate(dateInput);
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
      animate={{ opacity: 1, y: 0 }}
      className="group relative cursor-pointer rounded-sm border border-gray-100 bg-white p-4 transition-all duration-200 hover:border-gray-200"
      initial={{ opacity: 0, y: 20 }}
      onClick={handleClick}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -1, boxShadow: "0 4px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="mb-14 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-sm bg-gray-50 p-1">
            <BookOpen className="h-3 w-3 text-gray-600" />
          </div>
          <div>
            <h3 className="line-clamp-1 font-normal text-gray-900 text-sm transition-colors group-hover:text-gray-700">
              {documentTitle}
            </h3>
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Calendar className="h-2.5 w-2.5" />
              <span>{formatDate(chat.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Context Menu */}
        <DropdownMenu modal={true}>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-6 w-6 p-0 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-60"
              onClick={(e) => e.stopPropagation()}
              size="sm"
              variant="ghost"
            >
              <MoreHorizontalIcon className="h-3 w-3" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
            side="bottom"
          >
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
                    {visibilityType === "public" ? (
                      <CheckCircleFillIcon />
                    ) : null}
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
        <p className="line-clamp-2 text-gray-600 text-xs leading-relaxed">
          {summary}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-gray-300 text-xs">
          {formatLastActivity(chat.createdAt)}
        </span>
        <div className="font-normal text-gray-400 text-xs group-hover:text-gray-500">
          Continue →
        </div>
      </div>

      {/* Hover Effect */}
      <div className="pointer-events-none absolute inset-0 rounded-sm bg-gradient-to-r from-gray-50/0 to-gray-50/0 transition-all duration-200 group-hover:from-gray-50/20 group-hover:to-gray-50/5" />
    </motion.div>
  );
}

export function NotebookCards() {
  const { data, error, isLoading, mutate } = useSWRInfinite<ChatHistory>(
    getChatHistoryPaginationKey,
    fetcher,
    {
      revalidateFirstPage: false,
    }
  );

  const chats = data ? data.flatMap((page) => page.chats) : [];

  console.log("NotebookCards debug:", { data, error, isLoading, chats });

  const handleDeleteChat = (chatId: string) => {
    const deletePromise = fetch(`/api/chat?id=${chatId}`, {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting chat...",
      success: () => {
        mutate((chatHistories) => {
          if (chatHistories) {
            return chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.filter((chat) => chat.id !== chatId),
            }));
          }
        });
        return "Chat deleted successfully";
      },
      error: "Failed to delete chat",
    });
  };

  if (error) {
    console.error("NotebookCards error:", error);
    return (
      <div className="p-4 text-center text-red-500 text-sm">
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
      <div className="p-4 text-center text-gray-500 text-sm">
        No notebooks yet. Upload a document to get started!
      </div>
    );
  }

  console.log("NotebookCards: Rendering", chats.length, "chats");

  return (
    <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {chats.map((chat, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          key={chat.id}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          viewport={{ once: true, amount: 0.2 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <NotebookCard chat={chat} onDelete={handleDeleteChat} />
        </motion.div>
      ))}
    </div>
  );
}
