import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getDocumentSummary, getMessagesByChatId } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";
import { auth } from "../(auth)/auth";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id?: string }>;
  searchParams: Promise<{ doc?: string; summary?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  const { id: chatId } = await params;
  const searchParamsData = await searchParams;
  const documentId = searchParamsData.doc;
  const summaryText = searchParamsData.summary;

  // Use provided chat ID or generate a new one
  const id = chatId || generateUUID();

  // If a document is provided, we'll handle PDF context in the chat
  if (documentId) {
    try {
      // Load existing messages from database if chatId is provided
      let existingMessages: any[] = [];
      if (chatId) {
        try {
          existingMessages = await getMessagesByChatId({ id: chatId });
          console.log(
            `📨 Loaded ${existingMessages.length} existing messages for chat ${chatId}`
          );
          existingMessages.forEach((msg, index) => {
            console.log(`📨 Message ${index + 1}:`, {
              id: msg.id,
              role: msg.role,
              partsCount: msg.parts?.length || 0,
              hasPdfUpload: msg.parts?.some(
                (part: any) => part.type === "data-pdfUpload"
              ),
            });
          });
        } catch (dbError) {
          console.error(
            "❌ Database not available for loading messages:",
            dbError
          );
          throw new Error(
            `Failed to load chat messages: ${dbError instanceof Error ? dbError.message : String(dbError)}`
          );
        }
      }

      // If we have existing messages, use them; otherwise create initial message
      let initialMessages: any[] = [];

      if (existingMessages.length > 0) {
        // Use existing messages from database
        initialMessages = existingMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          parts: msg.parts,
          createdAt: msg.createdAt,
        }));
        console.log(
          `📨 Using ${initialMessages.length} existing messages for chat display`
        );
      } else {
        // Create initial message for new PDF chats
        let documentSummary: {
          summary: string;
          suggestedActions: string[];
        } | null = null;
        try {
          documentSummary = await getDocumentSummary({ documentId });
        } catch (dbError) {
          console.warn("Database not available, using mock summary:", dbError);
          // Use mock summary when database is not available
          documentSummary = {
            summary:
              summaryText ||
              `I've read your document and I'm ready to help you learn!`,
            suggestedActions: [
              "Show lesson summaries",
              "Generate practice questions",
              "Create flashcards",
              "Ask specific questions",
            ],
          };
        }

        // Create initial message with document context if we have a summary
        if (summaryText || documentSummary?.summary) {
          initialMessages = [
            {
              id: generateUUID(),
              role: "assistant" as const,
              parts: [
                {
                  type: "text" as const,
                  text: summaryText || documentSummary?.summary || "",
                },
              ],
              createdAt: new Date(),
            },
          ];
        }
      }

      const cookieStore = await cookies();
      const modelIdFromCookie = cookieStore.get("chat-model");

      return (
        <>
          <Chat
            autoResume={false}
            documentIds={[documentId]}
            id={id}
            initialChatModel={modelIdFromCookie?.value || DEFAULT_CHAT_MODEL}
            initialMessages={initialMessages}
            initialVisibilityType="private"
            isReadonly={false}
            key={id}
          />
          <DataStreamHandler />
        </>
      );
    } catch (error) {
      console.error("Failed to load document:", error);
      // Fall back to regular chat
    }
  }

  // Regular chat interface
  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          autoResume={false}
          id={id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={[]}
          initialVisibilityType="private"
          isReadonly={false}
          key={id}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={modelIdFromCookie.value}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        key={id}
      />
      <DataStreamHandler />
    </>
  );
}
