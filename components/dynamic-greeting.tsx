"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { BookOpen, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { fetcher } from "@/lib/utils";
import useSWRInfinite from "swr/infinite";

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatHistory {
  chats: Chat[];
  hasMore: boolean;
}

interface GreetingData {
  user: {
    name: string;
    lastActivity: string | null;
    notebookCount: number;
  };
  lastNotebook: Chat | null;
  timeContext: {
    period: "morning" | "afternoon" | "evening";
    daysSinceLast: number;
  };
}

function getTimePeriod(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getDaysSinceLast(lastActivity: string | null): number {
  if (!lastActivity) return 999; // No activity
  const lastDate = new Date(lastActivity);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function generateGreeting(data: GreetingData): { primary: string; secondary: string; hasEmbeddedNotebook: boolean } {
  const { user, lastNotebook, timeContext } = data;
  const { name, notebookCount } = user;
  const { period, daysSinceLast } = timeContext;

  // No notebooks yet
  if (notebookCount === 0) {
    return {
      primary: `Hey ${name} 👋`,
      secondary: "Ready to create your first notebook?",
      hasEmbeddedNotebook: false
    };
  }

  // Recent activity (within 24 hours)
  if (daysSinceLast < 1) {
    const timeEmojis = { morning: "☀️", afternoon: "🌤️", evening: "🌙" };
    const timeGreetings = {
      morning: "Good morning",
      afternoon: "Welcome back", 
      evening: "Evening"
    };
    
    return {
      primary: `${timeGreetings[period]}, ${name} ${timeEmojis[period]}`,
      secondary: lastNotebook 
        ? `Let's pick up where you left off in`
        : "Ready to continue learning?",
      hasEmbeddedNotebook: !!lastNotebook
    };
  }

  // Recent activity (1-7 days)
  if (daysSinceLast < 7) {
    return {
      primary: `Welcome back, ${name} 👋`,
      secondary: lastNotebook 
        ? `You were working on`
        : "Ready to dive back in?",
      hasEmbeddedNotebook: !!lastNotebook
    };
  }

  // Long inactivity (>7 days)
  return {
    primary: `It's been a while, ${name} 👀`,
    secondary: lastNotebook 
      ? `Let's dive back into`
      : "Ready to create something amazing?",
    hasEmbeddedNotebook: !!lastNotebook
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function DynamicGreeting() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // Use the same data fetching pattern as NotebookCards
  const {
    data,
    error,
    isLoading,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    revalidateFirstPage: false,
  });

  const chats = data ? data.flatMap((page) => page.chats) : [];

  // Debug logging
  console.log("DynamicGreeting Debug:", {
    data,
    error,
    isLoading,
    chats,
    session: session?.user
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show error state for debugging
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-lg text-red-600">Error loading notebooks</div>
        <div className="text-sm text-gray-500 mt-2">
          Error: {error.message}
        </div>
      </div>
    );
  }

  const userName = session?.user?.name || "there";
  const lastNotebook = chats?.[0] || null;
  const notebookCount = chats?.length || 0;
  const lastActivity = lastNotebook?.updatedAt || null;
  
  const timeContext = {
    period: getTimePeriod(),
    daysSinceLast: getDaysSinceLast(lastActivity)
  };

  const greetingData: GreetingData = {
    user: { name: userName, lastActivity, notebookCount },
    lastNotebook,
    timeContext
  };

  const { primary, secondary, hasEmbeddedNotebook } = generateGreeting(greetingData);
  const { daysSinceLast } = timeContext;

  const handleContinueClick = () => {
    if (lastNotebook) {
      router.push(`/chat/${lastNotebook.id}`);
    }
  };

  return (
    <div className="text-center py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-4"
      >
        {/* Primary Greeting */}
        <h1 className="text-2xl font-normal text-gray-900">
          {primary}
        </h1>
        
        {/* Secondary Message with Embedded Notebook */}
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          {hasEmbeddedNotebook && lastNotebook ? (
            <>
              {secondary}{" "}
              <span 
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100 transition-all duration-200 cursor-pointer group text-gray-700 font-normal text-base"
                onClick={handleContinueClick}
              >
                <BookOpen className="h-3 w-3 text-gray-500" />
                {lastNotebook.title}
                <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors ml-1">
                  →
                </span>
              </span>
              {daysSinceLast < 1 ? " →" : daysSinceLast < 7 ? ". Shall we continue?" : " or start something new."}
            </>
          ) : (
            secondary
          )}
        </p>
      </motion.div>
    </div>
  );
}