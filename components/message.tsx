"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { memo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PDFUploadMessage } from "./messages/pdf-upload-message";
import { QuizOfferMessage } from "./messages/QuizOfferMessage";
import { PreviewAttachment } from "./preview-attachment";
import { QuizArtifactTrigger } from "./quiz-artifact-trigger";
import { QuizCard, QuizResult } from "./quiz-card";
import { Weather } from "./weather";

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      initial={{ opacity: 0 }}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "min-h-96": message.role === "assistant" && requiresScrollPadding,
            "w-full":
              (message.role === "assistant" &&
                message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                )) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            console.log("Processing message part:", { type, part, index });

            if (type === "reasoning" && part.text?.trim().length > 0) {
              return (
                <MessageReasoning
                  isLoading={isLoading}
                  key={key}
                  reasoning={part.text}
                />
              );
            }

            if (type === "data-quizOffer") {
              return <QuizOfferMessage {...part.data} key={key} />;
            }

            if (type === "data-pdfUpload") {
              return (
                <PDFUploadMessage
                  className="w-full max-w-4xl"
                  data={part.data}
                  key={key}
                />
              );
            }

            if (type === "text") {
              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "w-fit break-words rounded-2xl px-3 py-2 text-right text-white":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                      style={
                        message.role === "user"
                          ? { backgroundColor: "#006cff" }
                          : undefined
                      }
                    >
                      <Response 
                        isStreaming={isLoading && message.role === "assistant"}
                        speed={20}
                      >
                        {sanitizeText(part.text)}
                      </Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            if (type === "tool-getWeather") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-getWeather" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={<Weather weatherAtLocation={part.output} />}
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-createDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error creating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={part.output}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error updating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...part.output, isUpdate: true }}
                    isReadonly={isReadonly}
                    result={part.output}
                  />
                </div>
              );
            }

            // Tool-call handler for askQuizQuestion -> trigger quiz artifact
            if (
              (type as any) === "tool-call" &&
              (part as any).toolName === "askQuizQuestion"
            ) {
              const toolPart = part as any;
              const input = toolPart.args || toolPart.input;

              return (
                <QuizArtifactTrigger
                  key={`tool-askQuizQuestion-${message.id}-${index}`}
                  messageId={message.id}
                  partIndex={index}
                  quizData={{
                    quizId: input?.quizId || crypto.randomUUID(),
                    title: input?.title,
                    questions: input?.questions,
                    totalQuestions: input?.totalQuestions,
                    // Legacy single question format
                    question: input?.question,
                    options: input?.options,
                    questionNumber: input?.questionNumber,
                    difficulty: input?.difficulty,
                    sourcePage: input?.sourcePage,
                    correctAnswer: input?.correctAnswer,
                  }}
                />
              );
            }

            if ((type as any) === "data-quiz-result") {
              console.log("Rendering quiz result:", part);
              const quizResultPart = part as any;
              return (
                <div
                  className="my-4"
                  key={`quiz-result-${quizResultPart.data.quizId}-${index}`}
                >
                  <QuizResult
                    explanation={quizResultPart.data.explanation}
                    isCorrect={quizResultPart.data.isCorrect}
                    isLastQuestion={quizResultPart.data.isLastQuestion}
                    onFinish={() => {
                      console.log("Quiz finished");
                    }}
                    onNext={() => {
                      // Next question will be automatically posted by the server
                      console.log("Next question requested");
                    }}
                    question={quizResultPart.data.question}
                    userAnswer={quizResultPart.data.userAnswer}
                  />
                </div>
              );
            }

            if ((type as any) === "data-quiz-question") {
              console.log("Rendering quiz question:", part);
              console.log("Quiz question data:", (part as any).data);
              const quizQuestionPart = part as any;
              console.log(
                "Quiz question part after casting:",
                quizQuestionPart
              );
              return (
                <div
                  className="my-4"
                  key={`quiz-question-${quizQuestionPart.data.quizId}-${index}`}
                >
                  <QuizCard
                    onSubmit={async (answer) => {
                      try {
                        console.log("Quiz answer submitted:", answer);
                        // Import the server action dynamically
                        const { submitChatQuizAnswer } = await import(
                          "@/app/actions/chat-quiz"
                        );

                        // Get documentIds from sessionStorage
                        const sessionDocIds = JSON.parse(
                          sessionStorage.getItem(`chat-${chatId}-docIds`) ||
                            "[]"
                        );

                        await submitChatQuizAnswer({
                          quizId: quizQuestionPart.data.quizId,
                          questionId: quizQuestionPart.data.question.id,
                          answer,
                          documentIds: sessionDocIds,
                        });

                        // Trigger message refresh
                        window.dispatchEvent(
                          new CustomEvent("refresh-messages", {
                            detail: { chatId },
                          })
                        );
                      } catch (error) {
                        console.error("Failed to submit quiz answer:", error);
                      }
                    }}
                    question={quizQuestionPart.data.question}
                    questionNumber={quizQuestionPart.data.questionNumber}
                    totalQuestions={quizQuestionPart.data.totalQuestions}
                  />
                </div>
              );
            }

            // Handle old format quiz-question (fallback)
            if ((type as any) === "quiz-question") {
              console.log("Rendering old format quiz question:", part);
              const quizQuestionPart = part as any;
              return (
                <div
                  className="my-4"
                  key={`quiz-question-old-${quizQuestionPart.quizId}-${index}`}
                >
                  <QuizCard
                    onSubmit={async (answer) => {
                      try {
                        console.log("Quiz answer submitted:", answer);
                        // Import the server action dynamically
                        const { submitChatQuizAnswer } = await import(
                          "@/app/actions/chat-quiz"
                        );

                        // Get documentIds from sessionStorage
                        const sessionDocIds = JSON.parse(
                          sessionStorage.getItem(`chat-${chatId}-docIds`) ||
                            "[]"
                        );

                        await submitChatQuizAnswer({
                          quizId: quizQuestionPart.quizId,
                          questionId: quizQuestionPart.question.id,
                          answer,
                          documentIds: sessionDocIds,
                        });

                        // Trigger message refresh
                        window.dispatchEvent(
                          new CustomEvent("refresh-messages", {
                            detail: { chatId },
                          })
                        );
                      } catch (error) {
                        console.error("Failed to submit quiz answer:", error);
                      }
                    }}
                    question={quizQuestionPart.question}
                    questionNumber={quizQuestionPart.questionNumber}
                    totalQuestions={quizQuestionPart.totalQuestions}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String((part as any).output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={part.output}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            // Fallback for unrecognized message types
            console.warn("Unrecognized message part type:", type, part);
            return (
              <div
                className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
                key={key}
              >
                <p className="text-sm text-yellow-800">
                  Unrecognized message type: {type}
                </p>
                <pre className="mt-2 text-xs text-yellow-700">
                  {JSON.stringify(part, null, 2)}
                </pre>
              </div>
            );
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }

    return false;
  }
);

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      initial={{ opacity: 0 }}
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="p-0 text-muted-foreground text-sm">
            <LoadingText>Thinking...</LoadingText>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingText = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      animate={{ backgroundPosition: ["100% 50%", "-100% 50%"] }}
      className="flex items-center text-transparent"
      style={{
        background:
          "linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground)) 35%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 65%, hsl(var(--muted-foreground)) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
      }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  );
};
