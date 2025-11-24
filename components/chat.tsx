"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { addSourceToChat } from "@/app/actions/add-source-to-chat";
import { uploadAndIngest } from "@/app/actions/upload-and-ingest";
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
import type { ChatContext, Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { AddSourceModal, type AddSourcePayload } from "./add-source-modal";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { HybridNotebookView } from "./hybrid-notebook-view";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import type { DocumentSourceMeta } from "./source-panel";
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
              (part as { type?: string }).type === ("data-pdfUpload" as const)
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
    return;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return;
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
      ?.filter((part) => (part as { type?: string }).type === "data-pdfUpload")
      .forEach((part) => {
        const payload = (
          part as {
            data?: {
              documentId?: string;
              documentTitle?: string;
              summary?: string;
              pageCount?: number;
            };
          }
        ).data;
        if (!payload?.documentId) {
          return;
        }

        derived[payload.documentId] = {
          id: payload.documentId,
          title: payload.documentTitle || "Untitled",
          summary: payload.summary,
          pageCount: payload.pageCount,
          addedAt: message.metadata?.createdAt 
            ? toIsoString(new Date(message.metadata.createdAt))
            : toIsoString(new Date()),
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
  initialContext,
  initialDifficultyLevel = "university",
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
  documentIds?: string[];
  initialContext?: ChatContext | null;
  initialDifficultyLevel?: "age12" | "age15" | "university";
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
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isSubmittingSource, setIsSubmittingSource] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const [context, setContext] = useState<ChatContext | null>(
    initialContext ?? null
  );
  const [currentMode, setCurrentMode] = useState<"agent" | "edit">("agent");
  const [difficultyLevel, setDifficultyLevel] = useState<
    "age12" | "age15" | "university"
  >(initialDifficultyLevel);

  useEffect(() => {
    setContext(initialContext ?? null);
  }, [initialContext]);

  const refreshContext = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat/${id}/context`);
      if (!response.ok) {
        return null;
      }
      const payload = await response.json();
      setContext(payload.context ?? null);
      return payload.context ?? null;
    } catch (err) {
      console.warn("Failed to refresh chat context", err);
      return null;
    }
  }, [id]);

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
  const contextDocumentIds = useMemo(
    () => (context?.sources ?? []).map((source) => source.documentId),
    [context]
  );
  const contextDocumentIdsKey = useMemo(
    () => contextDocumentIds.join("|"),
    [contextDocumentIds]
  );
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
  const panelSources = useMemo<DocumentSourceMeta[]>(() => {
    if (context?.sources?.length) {
      return context.sources.map((source) => ({
        id: source.documentId,
        title: source.title,
        summary: source.summary,
        type: "pdf" as const,
        pageCount: source.mainTopics?.[0]?.pages?.length ?? undefined,
        origin: "record",
      }));
    }
    return sources;
  }, [context, sources]);

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
            await refreshContext();
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
  }, [id, refreshContext, setMessages]);

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
        .flatMap(
          (msg) =>
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
    if (!context?.sources?.length) {
      return;
    }
    setSourceMeta((prev) => {
      const next = { ...prev };
      let changed = false;
      context.sources.forEach((source) => {
        const { documentId } = source;
        if (!documentId || next[documentId]?.origin === "record") {
          return;
        }
        next[documentId] = {
          id: documentId,
          title: source.title,
          summary: source.summary,
          pageCount: source.mainTopics?.[0]?.pages?.length ?? undefined,
          type: "pdf",
          origin: "record",
        };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [context]);

  useEffect(() => {
    if (!contextDocumentIds.length) {
      return;
    }
    setPersistedDocIds((prev) => {
      const merged = dedupeDocIds([...prev, ...contextDocumentIds]);
      if (merged.length !== prev.length && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          `chat-${id}-docIds`,
          JSON.stringify(merged)
        );
      }
      return merged;
    });
  }, [contextDocumentIdsKey, contextDocumentIds, id]);

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
    if (isReadonly) {
      return;
    }
    setAddSourceError(null);
    setIsAddSourceModalOpen(true);
  }, [isReadonly]);

  const handleAddSourceSubmit = useCallback(
    async (payload: AddSourcePayload) => {
      if (!id) {
        return;
      }
      setIsSubmittingSource(true);
      setAddSourceError(null);
      try {
        let deltaMessage: string | undefined;
        if (payload.kind === "pdf") {
          const formData = new FormData();
          formData.append("files", payload.file);
          const result = await uploadAndIngest(formData, { chatId: id });
          // Get delta message from first document result (when adding to existing chat)
          deltaMessage = result.documents?.[0]?.deltaMessage;
        } else {
          const contentType = payload.kind;
          const result = await addSourceToChat({
            chatId: id,
            contentType,
            content: contentType === "link" ? payload.url : payload.content,
            title:
              contentType === "link"
                ? payload.title
                : (payload.title ?? undefined),
          });
          deltaMessage = result.deltaMessage;
        }

        window.dispatchEvent(
          new CustomEvent("refresh-messages", { detail: { chatId: id } })
        );

        // Show delta message as toast if available, otherwise show generic message
        if (deltaMessage) {
          toast.success(deltaMessage);
        } else {
          toast.success("Source added to this chat");
        }

        setIsAddSourceModalOpen(false);
        await refreshContext();
      } catch (err) {
        console.error("Failed to add source", err);
        setAddSourceError(
          err instanceof Error ? err.message : "Failed to add source"
        );
      } finally {
        setIsSubmittingSource(false);
      }
    },
    [id, refreshContext]
  );

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <div className="h-12 shrink-0" />
        <ChatHeader
          chatId={id}
          difficultyLevel={difficultyLevel}
          isReadonly={isReadonly}
          onDifficultyChange={setDifficultyLevel}
          selectedVisibilityType={initialVisibilityType}
        />

        {/* Hybrid Notebook View - main content */}
        <div className="relative min-h-0 flex-1 pb-32">
          <HybridNotebookView
            chatId={id}
            isArtifactVisible={isArtifactVisible}
            isReadonly={isReadonly}
            messages={messages}
            onModeChange={setCurrentMode}
            regenerate={regenerate}
            selectedModelId={initialChatModel}
            setMessages={setMessages}
            status={status}
            votes={votes}
          />
        </div>

        {/* Only show input in Agent Mode, not Edit Mode */}
        {currentMode === "agent" && (
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-background">
            <div className="mx-auto flex w-full max-w-4xl gap-2 px-2 pb-3 md:px-4 md:pb-4">
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
        )}
      </div>

      {/* Sources panel hidden in game-focused pivot */}

      <AddSourceModal
        error={addSourceError}
        isSubmitting={isSubmittingSource}
        onOpenChange={setIsAddSourceModalOpen}
        onSubmit={handleAddSourceSubmit}
        open={isAddSourceModalOpen}
      />

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
