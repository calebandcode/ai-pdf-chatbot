"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import {
  SourcesCard,
  SourcesRail,
  type DocumentSourceMeta,
} from "./source-panel";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

const dedupeDocIds = (ids: string[]): string[] => {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
};

const extractDocIdsFromMessages = (messages: ChatMessage[]): string[] => {
  if (!messages || messages.length === 0) {
    return [];
  }
  const ids = messages
    .flatMap((msg) => {
      return (
        msg.parts
          ?.filter(
            (part) =>
              (part as { type?: string }).type ===
              ("data-pdfUpload" as const)
          )
          .map(
            (part) =>
              (part as { data?: { documentId?: string } }).data?.documentId
          ) ?? []
      );
    })
    .filter((docId): docId is string => Boolean(docId));

  return dedupeDocIds(ids);
};

const toIsoString = (
  value?: string | number | Date | null
): string | undefined => {
  if (!value) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const inferSourceTypeFromBlobUrl = (
  blobUrl?: string
): DocumentSourceMeta["type"] => {
  if (!blobUrl) {
    return "pdf";
  }
  if (blobUrl.startsWith("content://youtube")) {
    return "youtube";
  }
  if (blobUrl.startsWith("content://link")) {
    return "link";
  }
  if (blobUrl.startsWith("content://text")) {
    return "text";
  }
  return "pdf";
};

const deriveSourcesFromMessages = (
  messages: ChatMessage[]
): Record<string, DocumentSourceMeta> => {
  const derived: Record<string, DocumentSourceMeta> = {};

  messages.forEach((message) => {
    message.parts
      ?.filter(
        (part) => (part as { type?: string }).type === "data-pdfUpload"
      )
      .forEach((part) => {
        const payload = (part as {
          data?: {
            documentId?: string;
            documentTitle?: string;
            summary?: string;
            pageCount?: number;
          };
        }).data;
        if (!payload?.documentId) {
          return;
        }

        derived[payload.documentId] = {
          id: payload.documentId,
          title: payload.documentTitle || "Untitled",
          summary: payload.summary,
          pageCount: payload.pageCount,
          addedAt: toIsoString(message.createdAt),
          type: "pdf",
          origin: "message",
        };
      });
  });

  return derived;
};

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
  documentIds,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
  documentIds?: string[];
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);

  const [sourceMeta, setSourceMeta] = useState<
    Record<string, DocumentSourceMeta>
  >({});
  const [isSourcesLoading, setIsSourcesLoading] = useState(false);

  const [persistedDocIds, setPersistedDocIds] = useState<string[]>(() => {
    const initialIds = dedupeDocIds([
      ...(documentIds || []),
      ...extractDocIdsFromMessages(initialMessages),
    ]);
    if (typeof window === "undefined") {
      return initialIds;
    }
    try {
      const storedRaw = window.sessionStorage.getItem(`chat-${id}-docIds`);
      const storedIds = storedRaw ? JSON.parse(storedRaw) : [];
      const merged = dedupeDocIds([...storedIds, ...initialIds]);
      window.sessionStorage.setItem(
        `chat-${id}-docIds`,
        JSON.stringify(merged)
      );
      return merged;
    } catch {
      return initialIds;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const storedRaw = window.sessionStorage.getItem(`chat-${id}-docIds`);
      if (!storedRaw) {
        return;
      }
      const storedIds: string[] = JSON.parse(storedRaw);
      if (storedIds.length === 0) {
        return;
      }
      setPersistedDocIds((prev) => {
        const merged = dedupeDocIds([...prev, ...storedIds]);
        if (merged.length !== prev.length) {
          window.sessionStorage.setItem(
            `chat-${id}-docIds`,
            JSON.stringify(merged)
          );
        }
        return merged;
      });
    } catch {
      // ignore parse failures
    }
  }, [id]);

  const documentIdsKey = useMemo(() => {
    return (documentIds || []).join("|");
  }, [documentIds]);

  useEffect(() => {
    if (!documentIds || documentIds.length === 0) {
      return;
    }
    setPersistedDocIds((prev) => {
      const merged = dedupeDocIds([...prev, ...documentIds]);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          `chat-${id}-docIds`,
          JSON.stringify(merged)
        );
      }
      return merged;
    });
  }, [documentIdsKey, id]);

  const allDocumentIds = persistedDocIds;
  const allDocumentIdsKey = useMemo(
    () => allDocumentIds.join("|"),
    [allDocumentIds]
  );
  const missingDocumentIds = useMemo(() => {
    return allDocumentIds.filter((docId) => {
      const meta = sourceMeta[docId];
      return !meta || meta.origin !== "record";
    });
  }, [allDocumentIdsKey, sourceMeta]);
  const missingDocumentIdsKey = useMemo(
    () => missingDocumentIds.join("|"),
    [missingDocumentIds]
  );
  const sources = useMemo(() => {
    return allDocumentIds
      .map((docId) => sourceMeta[docId])
      .filter((meta): meta is DocumentSourceMeta => Boolean(meta));
  }, [allDocumentIdsKey, sourceMeta]);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            documentIds: allDocumentIds,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // Also refresh messages to ensure we have the latest from database
      window.dispatchEvent(
        new CustomEvent("refresh-messages", { detail: { chatId: id } })
      );
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  // On mount, if there is a pending PDF upload message for this docId, send a dummy user message
  useEffect(() => {
    if (!documentIds || documentIds.length === 0) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      const pending = JSON.parse(
        sessionStorage.getItem("pendingPdfMessage") || "null"
      );
      if (pending && documentIds.includes(pending.docId)) {
        // Fire a user message to create chat entry
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: `PDF uploaded: ${pending.title || "Document"}`,
            },
          ],
        });
        toast({
          type: "success",
          description: `PDF uploaded: ${pending.title}`,
        });
        console.log("Sent PDF marker message for new chat:", pending);
        sessionStorage.removeItem("pendingPdfMessage");
      }
    } catch (error) {
      console.warn("Error handling pending PDF message:", error);
    }
    // Only on initial render for the sessionStorage effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentIds, sendMessage]);

  // Listen for message refresh events from server actions
  useEffect(() => {
    const handleRefreshMessages = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { chatId: eventChatId } = customEvent.detail;
      if (eventChatId === id) {
        try {
          // Fetch latest messages from server
          const response = await fetch(`/api/chat/${id}/messages`);
          if (response.ok) {
            const latestMessages = await response.json();
            setMessages(latestMessages);
          }
        } catch (error) {
          console.warn("Failed to refresh messages:", error);
        }
      }
    };

    window.addEventListener("refresh-messages", handleRefreshMessages);
    return () => {
      window.removeEventListener("refresh-messages", handleRefreshMessages);
    };
  }, [id, setMessages]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  useEffect(() => {
    if (!messages?.length) {
      return;
    }

    const idsFromMessages = dedupeDocIds(
      messages
        .flatMap((msg) =>
          msg.parts
            ?.filter(
              (part) =>
                (part as { type?: string }).type === ("data-pdfUpload" as const)
            )
            .map(
              (part) =>
                (part as { data?: { documentId?: string } }).data?.documentId
            ) ?? []
        )
        .filter((docId): docId is string => Boolean(docId))
    );

    if (idsFromMessages.length === 0) {
      return;
    }

    setPersistedDocIds((prev) => {
      const merged = dedupeDocIds([...prev, ...idsFromMessages]);
      if (typeof window !== "undefined" && merged.length !== prev.length) {
        window.sessionStorage.setItem(
          `chat-${id}-docIds`,
          JSON.stringify(merged)
        );
      }
      return merged;
    });
  }, [id, messages]);

  useEffect(() => {
    if (!messages?.length) {
      return;
    }

    const derived = deriveSourcesFromMessages(messages);
    if (Object.keys(derived).length === 0) {
      return;
    }

    setSourceMeta((previous) => {
      const next = { ...previous };
      let changed = false;

      Object.values(derived).forEach((meta) => {
        const existing = next[meta.id];
        if (!existing) {
          next[meta.id] = meta;
          changed = true;
          return;
        }

        let entryChanged = false;
        const merged: DocumentSourceMeta = { ...existing };

        if (!existing.summary && meta.summary) {
          merged.summary = meta.summary;
          entryChanged = true;
        }

        if (!existing.pageCount && meta.pageCount) {
          merged.pageCount = meta.pageCount;
          entryChanged = true;
        }

        if (!existing.addedAt && meta.addedAt) {
          merged.addedAt = meta.addedAt;
          entryChanged = true;
        }

        if (existing.origin !== "record") {
          if (meta.title && meta.title !== existing.title) {
            merged.title = meta.title;
            entryChanged = true;
          }

          if (meta.type && meta.type !== existing.type) {
            merged.type = meta.type;
            entryChanged = true;
          }

          if (meta.origin && meta.origin !== existing.origin) {
            merged.origin = meta.origin;
            entryChanged = true;
          }
        }

        if (entryChanged) {
          next[meta.id] = merged;
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [messages]);

  useEffect(() => {
    const idsToFetch = missingDocumentIdsKey
      ? missingDocumentIdsKey.split("|").filter(Boolean)
      : [];

    if (idsToFetch.length === 0) {
      setIsSourcesLoading(false);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    async function loadDocuments(ids: string[]) {
      try {
        setIsSourcesLoading(true);
        const params = new URLSearchParams({ ids: ids.join(",") });
        const response = await fetch(`/api/documents?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch documents");
        }

        const payload = (await response.json()) as {
          documents: Array<{
            id: string;
            title: string;
            blobUrl: string;
            createdAt: string;
          }>;
        };

        if (!isActive) {
          return;
        }

        if (!payload.documents?.length) {
          return;
        }

        setSourceMeta((previous) => {
          const next = { ...previous };
          let changed = false;

          payload.documents.forEach((doc) => {
            const meta: DocumentSourceMeta = {
              id: doc.id,
              title: doc.title || "Untitled",
              type: inferSourceTypeFromBlobUrl(doc.blobUrl),
              addedAt: toIsoString(doc.createdAt),
              origin: "record",
            };

            const existing = next[doc.id];
            if (!existing) {
              next[doc.id] = meta;
              changed = true;
              return;
            }

            const merged: DocumentSourceMeta = {
              ...existing,
              title: meta.title || existing.title,
              addedAt: existing.addedAt ?? meta.addedAt,
              type: meta.type ?? existing.type,
              origin: "record",
            };

            if (
              merged.title !== existing.title ||
              merged.addedAt !== existing.addedAt ||
              merged.type !== existing.type ||
              merged.origin !== existing.origin
            ) {
              next[doc.id] = merged;
              changed = true;
            }
          });

          return changed ? next : previous;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Unable to fetch document metadata:", error);
        }
      } finally {
        if (isActive) {
          setIsSourcesLoading(false);
        }
      }
    }

    loadDocuments(idsToFetch);

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [missingDocumentIdsKey]);

  const handleAddSource = useCallback(() => {
    if (isReadonly || typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new CustomEvent("open-content-type-menu"));
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[data-testid="multimodal-input"]'
      );
      if (textarea) {
        textarea.scrollIntoView({ behavior: "smooth", block: "nearest" });
        textarea.focus();
      }
    });
  }, [isReadonly]);

  const shouldShowSources =
    allDocumentIds.length > 0 && (sources.length > 0 || isSourcesLoading);

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        {shouldShowSources && (
          <SourcesRail
            disabled={isReadonly}
            isLoading={isSourcesLoading}
            onAddSource={handleAddSource}
            sources={sources}
          />
        )}

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-30 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              documentIds={allDocumentIds}
              input={input}
              messages={messages}
              onModelChange={setCurrentModelId}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      {shouldShowSources && (
        <div className="pointer-events-none fixed right-4 bottom-28 z-40 hidden lg:block">
          <div className="pointer-events-auto">
            <SourcesCard
              disabled={isReadonly}
              isLoading={isSourcesLoading}
              onAddSource={handleAddSource}
              sources={sources}
            />
          </div>
        </div>
      )}

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
