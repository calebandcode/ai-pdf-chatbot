"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Trigger } from "@radix-ui/react-select";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { generateQuiz } from "@/app/actions/generate-quiz";
import { uploadAndIngest } from "@/app/actions/upload-and-ingest";
import { SelectItem } from "@/components/ui/select";
import { chatModels } from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import type { Attachment, ChatMessage, QuizOfferPayload } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, generateUUID } from "@/lib/utils";
import { Context } from "./elements/context";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CpuIcon,
  PaperclipIcon,
  StopIcon,
} from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { SuggestedActions } from "./suggested-actions";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  usage,
  onDocumentUploaded,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: AppUsage;
  onDocumentUploaded?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [isProcessingAttachments, setIsProcessingAttachments] = useState(false);

  const submitForm = useCallback(async () => {
    if (isProcessingAttachments) {
      return;
    }

    window.history.replaceState({}, "", "/");

    const trimmedInput = input.trim();

    if (!trimmedInput && attachments.length > 0) {
      try {
        setIsProcessingAttachments(true);

        const formData = new FormData();

        await Promise.all(
          attachments.map(async (attachment) => {
            if (attachment.file) {
              formData.append("files", attachment.file, attachment.file.name);
              return;
            }

            const response = await fetch(attachment.url);

            if (!response.ok) {
              throw new Error("Failed to fetch attachment for ingestion");
            }

            const blob = await response.blob();
            const fallbackName =
              attachment.name ||
              `document-${Math.random().toString(36).slice(2)}.pdf`;

            const ingestedFile = new File([blob], fallbackName, {
              type: attachment.contentType || "application/pdf",
            });

            formData.append("files", ingestedFile, ingestedFile.name);
          })
        );

        const { documents } = await uploadAndIngest(formData);

        if (!documents || documents.length === 0) {
          throw new Error("No documents returned from ingestion");
        }

        // Check if we're in an existing chat or starting fresh
        const isNewChat = messages.length === 0;

        if (isNewChat) {
          // For new chats: redirect to chat with document context
          const firstDoc = documents[0];
          if (firstDoc?.documentId && firstDoc?.summary) {
            const chatUrl = `/?doc=${firstDoc.documentId}&summary=${encodeURIComponent(firstDoc.summary)}`;
            window.location.href = chatUrl;
            return;
          }
        } else {
          // For existing chats: send a message with the document context
          const firstDoc = documents[0];
          if (firstDoc?.documentId && firstDoc?.summary) {
            // Send a message indicating the document was uploaded
            const documentMessage = {
              id: generateUUID(),
              role: "assistant" as const,
              parts: [
                {
                  type: "text" as const,
                  text: `📄 I've processed your PDF: "${firstDoc.title}". ${firstDoc.summary} You can now ask questions about this document.`,
                },
              ],
              createdAt: new Date(),
            };

            setMessages((currentMessages) => [
              ...currentMessages,
              documentMessage,
            ]);
          }
        }

        // Fallback: generate quiz offers for non-PDF documents
        const documentIds = documents.map((doc) => doc.documentId);

        const [easyQuiz, hardQuiz] = await Promise.all([
          generateQuiz({ documentIds, difficulty: "easy" }),
          generateQuiz({ documentIds, difficulty: "hard" }),
        ]);

        const quizPayload: QuizOfferPayload = {
          easy: {
            quizId: easyQuiz.quizId,
            count: easyQuiz.count,
            title: easyQuiz.title,
          },
          hard: {
            quizId: hardQuiz.quizId,
            count: hardQuiz.count,
            title: hardQuiz.title,
          },
        };

        const now = new Date().toISOString();

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: generateUUID(),
            role: "assistant",
            name: "quiz-offer",
            metadata: { createdAt: now },
            parts: [
              {
                type: "data-quizOffer",
                data: quizPayload,
              },
            ],
          },
        ]);

        setAttachments([]);
        setLocalStorageInput("");
        resetHeight();
        setInput("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (width && width > 768) {
          textareaRef.current?.focus();
        }

        toast.success("Document processed. Pick a quiz difficulty to begin.");
      } catch (error) {
        console.error("Failed to process attachments", error);
        toast.error(
          "We couldn't process your document. Please try again shortly."
        );
      } finally {
        setIsProcessingAttachments(false);
      }

      return;
    }

    sendMessage({
      role: "user",
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text",
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    chatId,
    isProcessingAttachments,
    input,
    resetHeight,
    sendMessage,
    setAttachments,
    setInput,
    setLocalStorageInput,
    setMessages,
    width,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType ?? file.type ?? "application/pdf",
          file,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const _modelResolver = useMemo(() => {
    return myProvider.languageModel(selectedModelId);
  }, [selectedModelId]);

  const contextProps = useMemo(
    () => ({
      usage,
    }),
    [usage]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      // Check if any files are PDFs - if so, process them directly for ingestion
      const pdfFiles = files.filter((file) => file.type === "application/pdf");
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (pdfFiles.length > 0) {
        setUploadQueue(pdfFiles.map((file) => file.name));
        setIsProcessingAttachments(true);

        try {
          const formData = new FormData();
          for (const file of pdfFiles) {
            formData.append("files", file, file.name);
          }

          const { documents } = await uploadAndIngest(formData);

          if (!documents || documents.length === 0) {
            throw new Error("No documents returned from ingestion");
          }

          // Check if we're in an existing chat or starting fresh
          const isNewChat = messages.length === 0;

          if (isNewChat) {
            // For new chats: redirect to chat with document context
            const firstDoc = documents[0];
            if (firstDoc?.documentId && firstDoc?.summary) {
              const chatUrl = `/?doc=${firstDoc.documentId}&summary=${encodeURIComponent(firstDoc.summary)}`;
              window.location.href = chatUrl;
              return;
            }
          } else {
            // For existing chats: send a message with the document context
            const firstDoc = documents[0];
            if (firstDoc?.documentId && firstDoc?.summary) {
              // Send a message indicating the document was uploaded
              const documentMessage = {
                id: generateUUID(),
                role: "assistant" as const,
                parts: [
                  {
                    type: "text" as const,
                    text: `📄 I've processed your PDF: "${firstDoc.title}". ${firstDoc.summary} You can now ask questions about this document.`,
                  },
                ],
                createdAt: new Date(),
              };

              setMessages((currentMessages) => [
                ...currentMessages,
                documentMessage,
              ]);

              // Store documentIds in sessionStorage for this chat
              const currentDocIds = JSON.parse(
                sessionStorage.getItem(`chat-${chatId}-docIds`) || "[]"
              );
              const newDocIds = [...currentDocIds, firstDoc.documentId];
              sessionStorage.setItem(
                `chat-${chatId}-docIds`,
                JSON.stringify(newDocIds)
              );

              // Notify parent component to refresh documentIds
              onDocumentUploaded?.();
            }
          }

          toast.success("PDF processed successfully!");
        } catch (error) {
          console.error("Failed to process PDF", error);
          toast.error("Failed to process PDF. Please try again.");
        } finally {
          setUploadQueue([]);
          setIsProcessingAttachments(false);
        }
        return;
      }

      // Handle image files with the existing uploadFile logic
      if (imageFiles.length > 0) {
        setUploadQueue(imageFiles.map((file) => file.name));

        try {
          const uploadPromises = imageFiles.map((file) => uploadFile(file));
          const uploadedAttachments = await Promise.all(uploadPromises);
          const successfullyUploadedAttachments = uploadedAttachments.filter(
            (attachment) => attachment !== undefined
          );

          setAttachments((currentAttachments) => [
            ...currentAttachments,
            ...successfullyUploadedAttachments,
          ]);
        } catch (error) {
          console.error("Error uploading files!", error);
        } finally {
          setUploadQueue([]);
        }
      }
    },
    [
      setAttachments,
      uploadFile,
      messages.length,
      chatId,
      onDocumentUploaded,
      setMessages,
    ]
  );

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        setUploadQueue(files.map((file) => file.name));

        // Simulate file input change
        const event = {
          target: { files },
        } as unknown as ChangeEvent<HTMLInputElement>;
        handleFileChange(event);
      }
    },
    [handleFileChange]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        )}

      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-blue-500 border-dashed bg-blue-50/80 dark:bg-blue-950/80">
          <div className="text-center">
            <p className="font-medium text-blue-700 dark:text-blue-300">
              Drop PDF files here
            </p>
            <p className="text-blue-600 text-sm dark:text-blue-400">
              The AI tutor will read and start a chat
            </p>
          </div>
        </div>
      )}

      <input
        accept=".pdf"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <PromptInput
        className="rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onSubmit={async (event) => {
          event.preventDefault();
          if (status !== "ready" && !isProcessingAttachments) {
            toast.error("Please wait for the model to finish its response!");
          } else {
            await submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            autoFocus
            className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            data-testid="multimodal-input"
            disableAutoResize={true}
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            placeholder="Send a message or drag & drop a PDF to start learning..."
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
          <Context {...contextProps} />
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              selectedModelId={selectedModelId}
              status={status}
            />
            <ModelSelectorCompact
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
            />
          </PromptInputTools>

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              disabled={
                uploadQueue.length > 0 ||
                isProcessingAttachments ||
                (!input.trim() && attachments.length === 0)
              }
              status={isProcessingAttachments ? "submitted" : status}
            >
              <ArrowUpIcon size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const isReasoningModel = selectedModelId === "chat-model-reasoning";

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || isReasoningModel}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId
  );

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
      value={selectedModel?.name}
    >
      <Trigger
        className="flex h-8 items-center gap-2 rounded-lg border-0 bg-background px-2 text-foreground shadow-none transition-colors hover:bg-accent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        type="button"
      >
        <CpuIcon size={16} />
        <span className="hidden font-medium text-xs sm:block">
          {selectedModel?.name}
        </span>
        <ChevronDownIcon size={16} />
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem key={model.id} value={model.name}>
              <div className="truncate font-medium text-xs">{model.name}</div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {model.description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
