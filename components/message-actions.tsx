import equal from "fast-deep-equal";
import { BookmarkIcon, BookmarkCheckIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import {
  checkIfMessageIsSaved,
  saveBlockToNotebookAction,
  unsaveBlockAction,
} from "@/app/actions/save-block";
import type { ChatContext } from "@/lib/db/schema";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { Action, Actions } from "./elements/actions";
import { CopyIcon, PencilEditIcon, ThumbDownIcon, ThumbUpIcon } from "./icons";

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  setMode,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  // Check if message is already saved
  useEffect(() => {
    if (message.role === "assistant" && message.id) {
      checkIfMessageIsSaved(message.id)
        .then((result) => {
          if (result.success) {
            setIsSaved(result.isSaved || false);
          }
        })
        .catch((error) => {
          // Gracefully handle errors (e.g., table doesn't exist yet)
          // Don't break the UI - just assume message is not saved
          console.warn("Failed to check if message is saved:", error);
          setIsSaved(false);
        });
    }
  }, [message.id, message.role]);

  // Fetch chat context for topics
  useEffect(() => {
    if (message.role === "assistant") {
      fetch(`/api/chat/${chatId}/context`)
        .then((res) => res.json())
        .then((data) => {
          if (data.context) {
            setChatContext(data.context);
          }
        })
        .catch(() => {
          // Ignore errors
        });
    }
  }, [chatId, message.role]);

  const handleSaveToNotebook = async () => {
    if (isSaving || isSaved) return;

    setIsSaving(true);
    try {
      const result = await saveBlockToNotebookAction({
        chatId,
        messageId: message.id,
        blockType: "explanation", // Default, can be improved
        documentIds: [], // Can be extracted from message if needed
      });

      if (result.success) {
        setIsSaved(true);
        toast.success("Saved to notebook!");
        // Trigger refresh for Edit Mode
        window.dispatchEvent(
          new CustomEvent("refresh-messages", { detail: { chatId } })
        );
      } else {
        toast.error(result.error || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save block:", error);
      toast.error("Failed to save to notebook");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnsave = async () => {
    if (isSaving || !isSaved) return;

    setIsSaving(true);
    try {
      const result = await unsaveBlockAction({ messageId: message.id });

      if (result.success) {
        setIsSaved(false);
        toast.success("Removed from notebook");
        // Trigger refresh for Edit Mode
        window.dispatchEvent(
          new CustomEvent("refresh-messages", { detail: { chatId } })
        );
      } else {
        toast.error(result.error || "Failed to unsave");
      }
    } catch (error) {
      console.error("Failed to unsave block:", error);
      toast.error("Failed to remove from notebook");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  // User messages get edit (on hover) and copy actions
  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end">
        <div className="relative">
          {setMode && (
            <Action
              className="-left-10 absolute top-0 opacity-0 transition-opacity group-hover/message:opacity-100"
              onClick={() => setMode("edit")}
              tooltip="Edit"
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action onClick={handleCopy} tooltip="Copy">
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5">
      <Action onClick={handleCopy} tooltip="Copy">
        <CopyIcon />
      </Action>

      {/* Save to Notebook button - only for assistant messages */}
      {message.role === "assistant" && (
        <Action
          onClick={isSaved ? handleUnsave : handleSaveToNotebook}
          disabled={isSaving}
          tooltip={isSaved ? "Remove from notebook" : "Save to notebook"}
        >
          {isSaved ? (
            <BookmarkCheckIcon className="h-4 w-4 fill-current" />
          ) : (
            <BookmarkIcon className="h-4 w-4" />
          )}
        </Action>
      )}

      <Action
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() => {
          const upvote = fetch("/api/vote", {
            method: "PATCH",
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: "up",
            }),
          });

          toast.promise(upvote, {
            loading: "Upvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: true,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Upvoted Response!";
            },
            error: "Failed to upvote response.",
          });
        }}
        tooltip="Upvote Response"
      >
        <ThumbUpIcon />
      </Action>

      <Action
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() => {
          const downvote = fetch("/api/vote", {
            method: "PATCH",
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: "down",
            }),
          });

          toast.promise(downvote, {
            loading: "Downvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: false,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Downvoted Response!";
            },
            error: "Failed to downvote response.",
          });
        }}
        tooltip="Downvote Response"
      >
        <ThumbDownIcon />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }

    return true;
  }
);
