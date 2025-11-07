import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth, type UserType } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { pdfTutorSystemPrompt, type RequestHints } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { generatePdfQuiz } from "@/lib/ai/tools/generate-pdf-quiz";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getDocumentChunks,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { retrieveTopK } from "@/lib/retrieval";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

const MAX_CONTEXT_SNIPPETS = 6;
const MAX_CONTEXT_CHARS = 650;
const FOLLOW_UP_HINTS: Array<{ regex: RegExp; hint: string }> = [
  {
    regex: /\bsummary|overview|main idea\b/i,
    hint: "Would you like a section-by-section summary?",
  },
  {
    regex: /\bpractice|quiz|questions?\b/i,
    hint: "Want me to generate some practice questions on this topic?",
  },
  {
    regex: /\bexplain|clarify|confus(ed|ing)\b/i,
    hint: "Should we zoom in on that section for a deeper explanation?",
  },
  {
    regex: /\bverbs?|grammar|conjugation\b/i,
    hint: "Would reviewing the verb tables next be helpful?",
  },
];

const dedupeRequestDocumentIds = (ids?: string[]): string[] => {
  return Array.from(new Set((ids ?? []).filter((id): id is string => Boolean(id))));
};

type ContextSnippet = {
  id: string;
  page: number;
  text: string;
};

const normalizeSnippetText = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_CONTEXT_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_CONTEXT_CHARS)}...`;
};

const deriveFollowUpHint = (userMessage: string): string | null => {
  for (const { regex, hint } of FOLLOW_UP_HINTS) {
    if (regex.test(userMessage)) {
      return hint;
    }
  }
  return null;
};

const buildDocumentContextBlock = (
  snippets: ContextSnippet[],
  followUpHint: string | null
) => {
  if (!snippets.length) {
    return "";
  }
  const header =
    "You are assisting the user with their uploaded document. Use only the following excerpts as ground truth.";
  const instructions = [
    "Write a cohesive 2-3 sentence synthesis that references multiple excerpts.",
    "Cite each factual claim inline using (Source X, Page Y).",
    "If the answer is not present, say so and suggest where to look next in the document.",
    `End with one conversational follow-up tailored to this question${
      followUpHint ? ` (for example: "${followUpHint}")` : ""
    }.`,
  ].join(" ");

  const body = snippets
    .map(
      (snippet) => `${snippet.id} (Page ${snippet.page}): ${snippet.text}`
    )
    .join("\n\n");

  return `${header}\n\nExcerpts:\n${body}\n\nInstructions:\n${instructions}`;
};

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      documentIds,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
      documentIds?: string[];
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    // Handle database operations with fallbacks
    let messageCount = 0;
    let chat: any = null;
    let messagesFromDb: any[] = [];

    try {
      messageCount = await getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 24,
      });

      if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
        return new ChatSDKError("rate_limit:chat").toResponse();
      }

      chat = await getChatById({ id });

      if (chat) {
        if (chat.userId !== session.user.id) {
          return new ChatSDKError("forbidden:chat").toResponse();
        }
      } else {
        const title = await generateTitleFromUserMessage({
          message,
        });

        await saveChat({
          id,
          userId: session.user.id,
          title,
          visibility: selectedVisibilityType,
        });
      }

      messagesFromDb = await getMessagesByChatId({ id });
    } catch (dbError) {
      console.warn("Database not available for chat, using fallback:", dbError);
      // Continue with empty messages for development
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];
    const normalizedDocumentIds = dedupeRequestDocumentIds(documentIds);

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Check if we have document context for PDF tutoring
    let hasDocumentContext = false;
    let documentContext = "";

    if (normalizedDocumentIds.length > 0) {
      try {
        // Retrieve relevant chunks based on the user's message
        const userMessageText = message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ");

        const relevantChunks = await retrieveTopK({
          userId: session.user.id,
          docIds: normalizedDocumentIds,
          query: userMessageText,
          k: 12,
        });

        if (relevantChunks.length > 0) {
          hasDocumentContext = true;
          const snippets = relevantChunks
            .slice(0, MAX_CONTEXT_SNIPPETS)
            .map((chunk, index) => ({
              id: `Source ${index + 1}`,
              page: chunk.page,
              text: normalizeSnippetText(chunk.content),
            }));
          const followUpHint = deriveFollowUpHint(userMessageText);
          documentContext = buildDocumentContextBlock(snippets, followUpHint);
        }
      } catch (error) {
        console.warn("Failed to load document context, using mock:", error);
        hasDocumentContext = true;
        documentContext =
          "Document context is temporarily unavailable. Let the user know you could not retrieve the relevant excerpts and offer to help once the document is processed.";
      }
    }

    if (!hasDocumentContext && normalizedDocumentIds.length > 0) {
      hasDocumentContext = true;
      documentContext =
        "The user has uploaded document context for this conversation. Provide a 2-3 sentence synthesis grounded in that material, cite page numbers inline, and finish with one personalized follow-up question.";
    }

    try {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    } catch (dbError) {
      console.warn("Unable to save user message to database:", dbError);
    }

    const streamId = generateUUID();
    try {
      await createStreamId({ streamId, chatId: id });
    } catch (dbError) {
      console.warn("Unable to create stream ID:", dbError);
    }

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system:
            pdfTutorSystemPrompt({
              selectedChatModel,
              requestHints,
              hasDocumentContext,
            }) + (documentContext ? `\n\n${documentContext}` : ""),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === "chat-model-reasoning"
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                  ...(hasDocumentContext ? ["generatePdfQuiz" as const] : []),
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            ...(hasDocumentContext
              ? {
                  generatePdfQuiz: generatePdfQuiz({ session, dataStream }),
                }
              : {}),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        try {
          await saveMessages({
            messages: messages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        } catch (dbError) {
          console.warn("Unable to save messages to database:", dbError);
        }

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
