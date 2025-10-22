"use server";

import { drizzle } from "drizzle-orm/postgres-js";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { saveMessages } from "@/lib/db/queries";
import { tutorSession } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";

// Database connection
const client = postgres(process.env.POSTGRES_URL || "");
const db = drizzle(client);

const TutorSessionSchema = z.object({
  chatId: z.string(),
  documentIds: z.array(z.string()),
  topic: z.string(),
  subtopic: z.string().optional(),
  pages: z.array(z.number()).optional(),
});

const TutorCommandSchema = z.object({
  chatId: z.string(),
  command: z.enum(["skip", "repeat", "next", "stop"]),
  topicId: z.string().optional(),
  subtopicId: z.string().optional(),
});

export type TutorSessionState = {
  topicId: string;
  subtopicId?: string;
  step: "explain" | "quiz" | "remediate" | "advance" | "completed";
  progress: {
    totalAsked: number;
    totalCorrect: number;
    currentTopicAccuracy: number;
  };
  startedAt: string;
  currentPages: number[];
};

export async function startGuidedSession(
  data: z.infer<typeof TutorSessionSchema>
) {
  const { chatId, topic, subtopic, pages } = TutorSessionSchema.parse(data);

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    // Create session state
    const sessionState: TutorSessionState = {
      topicId: topic,
      subtopicId: subtopic,
      step: "explain",
      progress: {
        totalAsked: 0,
        totalCorrect: 0,
        currentTopicAccuracy: 0,
      },
      startedAt: new Date().toISOString(),
      currentPages: pages || [],
    };

    // Store in sessionStorage (will be handled client-side)
    // For now, we'll store in DB as fallback
    await db.tutorSession.upsert({
      where: { chatId },
      create: {
        chatId,
        userId: session.user.id,
        state: JSON.stringify(sessionState),
        updatedAt: new Date(),
      },
      update: {
        state: JSON.stringify(sessionState),
        updatedAt: new Date(),
      },
    });

    // Generate conversational explanation
    const explanationPrompt = `You are an AI tutor helping a student learn from their study material. 

Document topic: ${topic}
${subtopic ? `Subtopic: ${subtopic}` : ""}
${pages ? `Relevant pages: ${pages.join(", ")}` : ""}

Generate a conversational, engaging explanation that:
1. Introduces the topic naturally (like a tutor would)
2. Explains the key concepts in simple terms
3. Makes connections to real-world examples
4. Ends with enthusiasm for the upcoming quiz

Keep it conversational and warm, like you're personally guiding them through their study material.`;

    // Create explanation message
    await saveMessages({
      messages: [
        {
          id: generateUUID(),
          chatId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: explanationPrompt,
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    // Generate first quiz question
    const quizPrompt = `Based on the topic "${topic}"${subtopic ? ` and subtopic "${subtopic}"` : ""}, generate a multiple choice quiz question that tests understanding of the key concepts.

The question should:
1. Be clear and specific
2. Have 4 options (A, B, C, D)
3. Test comprehension, not memorization
4. Be appropriate for the topic level

Format as a tool call: askQuizQuestion`;

    // Create quiz message
    await saveMessages({
      messages: [
        {
          id: generateUUID(),
          chatId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: quizPrompt,
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    console.log("🎓 Tutor session started:", {
      chatId,
      topic,
      subtopic,
      pages: pages?.length || 0,
      userId: session.user.id,
    });

    revalidatePath(`/chat/${chatId}`);
    return { success: true, sessionState };
  } catch (error) {
    console.error("Failed to start tutor session:", error);
    throw new Error("Failed to start guided session");
  }
}

export async function handleTutorCommand(
  data: z.infer<typeof TutorCommandSchema>
) {
  const { chatId, command } = TutorCommandSchema.parse(data);

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    // Get current session state
    const tutorSession = await db.tutorSession.findUnique({
      where: { chatId },
    });

    if (!tutorSession) {
      throw new Error("No active tutor session");
    }

    const sessionState: TutorSessionState = JSON.parse(tutorSession.state);

    let responseMessage = "";
    let newStep: TutorSessionState["step"] = sessionState.step;

    switch (command) {
      case "skip":
        responseMessage = `Skipping ${sessionState.topicId}. Let's move to the next topic!`;
        newStep = "advance";
        break;
      case "repeat":
        responseMessage = `Let me explain ${sessionState.topicId} again in a different way...`;
        newStep = "explain";
        break;
      case "next":
        responseMessage = `Great! Moving to the next subtopic in ${sessionState.topicId}.`;
        newStep = "explain";
        break;
      case "stop":
        responseMessage =
          "Tutor session ended. You can always start a new guided lesson anytime!";
        newStep = "completed";
        break;
      default:
        responseMessage = "Unknown command received.";
        break;
    }

    // Update session state
    const updatedState: TutorSessionState = {
      ...sessionState,
      step: newStep,
    };

    await db.tutorSession.update({
      where: { chatId },
      data: {
        state: JSON.stringify(updatedState),
        updatedAt: new Date(),
      },
    });

    // Create response message
    await saveMessages({
      messages: [
        {
          id: generateUUID(),
          chatId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: responseMessage,
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    console.log("🎓 Tutor command executed:", {
      chatId,
      command,
      topicId: sessionState.topicId,
      subtopicId: sessionState.subtopicId,
    });

    revalidatePath(`/chat/${chatId}`);
    return { success: true, newStep };
  } catch (error) {
    console.error("Failed to handle tutor command:", error);
    throw new Error("Failed to execute tutor command");
  }
}

export async function resumeGuidedSession(chatId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    const tutorSession = await db.tutorSession.findUnique({
      where: { chatId },
    });

    if (!tutorSession) {
      return { success: false, reason: "No active session" };
    }

    const sessionState: TutorSessionState = JSON.parse(tutorSession.state);

    if (sessionState.step === "completed") {
      return { success: false, reason: "Session already completed" };
    }

    // Resume based on current step
    let resumeMessage = "";
    switch (sessionState.step) {
      case "explain":
        resumeMessage = `Welcome back! Let's continue learning about ${sessionState.topicId}.`;
        break;
      case "quiz":
        resumeMessage = `Ready for your quiz on ${sessionState.topicId}?`;
        break;
      case "remediate":
        resumeMessage = `Let's review ${sessionState.topicId} to make sure you understand it well.`;
        break;
      case "advance":
        resumeMessage = "Great progress! Let's move to the next topic.";
        break;
      case "completed":
        resumeMessage = "Session completed!";
        break;
    }

    await saveMessages({
      messages: [
        {
          id: generateUUID(),
          chatId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: resumeMessage,
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    console.log("🎓 Tutor session resumed:", {
      chatId,
      step: sessionState.step,
      topicId: sessionState.topicId,
    });

    revalidatePath(`/chat/${chatId}`);
    return { success: true, sessionState };
  } catch (error) {
    console.error("Failed to resume tutor session:", error);
    throw new Error("Failed to resume guided session");
  }
}
