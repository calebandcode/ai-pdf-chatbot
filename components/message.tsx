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
import { QuizCard, QuizResult } from "./quiz-card";
import { TutorMessage } from "./tutor-message";
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
                      <Response>{sanitizeText(part.text)}</Response>
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

            // New generic tool-call handler for askQuizQuestion -> render as QuizCard (no tool chrome)
            if (
              type === "tool-call" &&
              (part as any).toolName === "askQuizQuestion"
            ) {
              const toolPart = part as any;
              const input = toolPart.input ?? toolPart.args;
              const question = {
                id: input?.questionId || "q1",
                question: input?.question || "Question not available",
                type: "multiple_choice" as const,
                options: input?.options || {},
                correctAnswer: undefined,
                explanation: undefined,
                sourcePage: input?.sourcePage || 1,
                difficulty: input?.difficulty || ("easy" as const),
              };

              return (
                <div
                  className="my-4"
                  key={`tool-askQuizQuestion-${message.id}-${index}`}
                >
                  <QuizCard
                    onSubmit={async (answer) => {
                      try {
                        const { submitChatQuizAnswer } = await import(
                          "@/app/actions/chat-quiz"
                        );
                        const sessionDocIds = JSON.parse(
                          sessionStorage.getItem(`chat-${chatId}-docIds`) ||
                            "[]"
                        );
                        await submitChatQuizAnswer({
                          quizId: input?.quizId,
                          questionId: question.id,
                          answer,
                          documentIds: sessionDocIds,
                        });
                        window.dispatchEvent(
                          new CustomEvent("refresh-messages", {
                            detail: { chatId },
                          })
                        );
                      } catch (error) {
                        console.error("Failed to submit quiz answer:", error);
                      }
                    }}
                    question={question as any}
                    questionNumber={input?.questionNumber || 1}
                    totalQuestions={input?.totalQuestions || 1}
                  />
                </div>
              );
            }

            if (type === "tool-askQuizQuestion") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-askQuizQuestion" />
                  <ToolContent>
                    {state === "input-available" && (
                      <div className="w-fit max-w-2xl rounded-lg border border-gray-200 bg-white p-4">
                        {/* Question Header - Simple */}
                        <div className="mb-4">
                          <div className="mb-4 flex items-center gap-3">
                            <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800 text-sm">
                              Question{" "}
                              {(part as any).input?.questionNumber || 1} of{" "}
                              {(part as any).input?.totalQuestions || 1}
                            </span>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 text-sm">
                              Page {(part as any).input?.sourcePage || 1}
                            </span>
                            <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800 text-sm">
                              {(part as any).input?.difficulty || "easy"}
                            </span>
                          </div>

                          <h3 className="mb-4 font-medium text-base text-gray-900 leading-relaxed">
                            {(part as any).input?.question ||
                              "Question not available"}
                          </h3>
                        </div>

                        {/* Answer Options - Plain Text */}
                        <div className="space-y-2">
                          {Object.entries(
                            (part as any).input?.options || {}
                          ).map(([key, value]) => (
                            <label
                              className="flex cursor-pointer items-start gap-3 rounded px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                              key={key}
                            >
                              <input
                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                                name={`question-${(part as any).input?.quizId || "unknown"}`}
                                type="radio"
                                value={key}
                              />
                              <div className="flex-1">
                                <span className="font-medium text-sm">
                                  {key}.
                                </span>
                                <span className="ml-2 text-sm">{value}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in (part as any).output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String((part as any).output.error)}
                            </div>
                          ) : (
                            <div className="text-green-600 text-sm">
                              ✅ Quiz question answered successfully
                            </div>
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "data-quiz-result") {
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

            if (type === "data-quiz-question") {
              console.log("Rendering quiz question:", part);
              console.log("Quiz question data:", part.data);
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
            if (type === "quiz-question") {
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
                              Error: {String(part.output.error)}
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
