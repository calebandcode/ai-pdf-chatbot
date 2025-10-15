import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getDocumentSummary } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";
import { auth } from "../(auth)/auth";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; summary?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  const params = await searchParams;
  const documentId = params.doc;
  const summaryText = params.summary;

  const id = generateUUID();

  // If a document is provided, we'll handle PDF context in the chat
  if (documentId) {
    try {
      // Pre-load document context for the chat
      let documentSummary = null;
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
      const initialMessages =
        summaryText || documentSummary?.summary
          ? [
              {
                id: generateUUID(),
                role: "assistant" as const,
                parts: [
                  {
                    type: "text" as const,
                    text: `I've read your document and I'm ready to help you learn! ${summaryText || documentSummary?.summary || ""}`,
                  },
                ],
                createdAt: new Date(),
              },
            ]
          : [];

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
