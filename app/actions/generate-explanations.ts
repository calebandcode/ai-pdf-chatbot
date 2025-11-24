"use server";

import { generateText } from "ai";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { getDocumentRecordById, saveMessages } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { retrieveTopK } from "@/lib/retrieval";

type TopicExplanationParams = {
  topicName: string;
  description: string;
  pages: number[];
  documentTitle?: string;
  previousTopics?: string[];
  currentIndex?: number;
  totalTopics?: number;
  documentIds?: string[]; // Add documentIds to fetch actual content
  chatId?: string; // Add chatId to save explanation as message
};

export async function generateTopicExplanationAction({
  topicName,
  description,
  pages: _pages,
  documentTitle: _documentTitle,
  previousTopics = [],
  currentIndex: _currentIndex,
  totalTopics: _totalTopics,
  documentIds = [],
  chatId,
}: TopicExplanationParams) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get actual document content if documentIds are provided
    // Use semantic search instead of page-based fetching to find relevant chunks
    let documentContent = "";
    if (documentIds.length > 0) {
      console.log(
        "🔍 Fetching document content for topic explanation using semantic search:",
        {
          topicName,
          description,
          documentIds,
        }
      );

      try {
        // Create a search query from topic name and description
        const searchQuery = description
          ? `${topicName}: ${description}`
          : topicName;

        // Use semantic search to find relevant chunks
        // For TOPICS: Use fewer chunks (5-8) for a brief overview/introduction
        // Topics should introduce, not explain everything - subtopics will do the deep dive
        const relevantChunks = await retrieveTopK({
          userId: session.user.id,
          docIds: documentIds,
          query: searchQuery,
          k: 6, // Get top 6 chunks for brief topic overview (subtopics will be detailed)
        });

        if (relevantChunks.length > 0) {
          // Get document titles for each chunk (batch fetch for efficiency)
          const uniqueDocumentIds = [
            ...new Set(relevantChunks.map((chunk) => chunk.documentId)),
          ];
          const documentTitleMap = new Map<string, string>();

          // Fetch all document titles in parallel
          await Promise.all(
            uniqueDocumentIds.map(async (documentId) => {
              try {
                const doc = await getDocumentRecordById({ id: documentId });
                documentTitleMap.set(
                  documentId,
                  doc?.title || "Unknown Document"
                );
              } catch (error) {
                console.warn(
                  `Failed to get document title for ${documentId}:`,
                  error
                );
                documentTitleMap.set(documentId, "Unknown Document");
              }
            })
          );

          // Format chunks with document source information
          // Track which documents are being used for better cross-source synthesis
          const chunksByDocument = new Map<string, typeof relevantChunks>();
          for (const chunk of relevantChunks) {
            const docTitle =
              documentTitleMap.get(chunk.documentId) || "Unknown Document";
            if (!chunksByDocument.has(docTitle)) {
              chunksByDocument.set(docTitle, []);
            }
            const existingChunks = chunksByDocument.get(docTitle);
            if (existingChunks) {
              existingChunks.push(chunk);
            }
          }

          documentContent = relevantChunks
            .map((chunk) => {
              const docTitle =
                documentTitleMap.get(chunk.documentId) || "Unknown Document";
              return `[From "${docTitle}", Page ${chunk.page}]: ${chunk.content}`;
            })
            .join("\n\n");

          console.log(
            `✅ Topic explanation: Found ${relevantChunks.length} relevant chunks using semantic search`
          );
          const sourceNames = Array.from(chunksByDocument.keys());
          console.log(`📚 Sources used: ${sourceNames.join(", ")}`);
          const chunksPerDoc = Object.fromEntries(
            Array.from(chunksByDocument.entries()).map(([doc, chunks]) => [
              doc,
              chunks.length,
            ])
          );
          console.log("📊 Chunks per document:", chunksPerDoc);
          console.log(`📄 Sample content: ${documentContent.slice(0, 200)}...`);
        } else {
          console.warn("⚠️ No relevant chunks found using semantic search");
        }
      } catch (searchError) {
        console.warn("⚠️ Semantic search failed:", searchError);
      }
    }

    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      system: `You are an expert AI tutor helping a student learn from their uploaded documents. Your role is to provide clear, structured, and focused explanations.

Key behaviors for TOPIC explanations:
- Provide a BRIEF, STRUCTURED OVERVIEW (2-3 paragraphs maximum)
- Topics are INTRODUCTIONS - set the stage, don't explain everything
- Clearly state what the topic covers and what subtopics will explore
- Use clear structure: context → what will be covered → why it matters
- When multiple documents are available, briefly note their relevance
- Keep it concise, engaging, and inviting
- Connect to previous topics naturally
- CRITICAL: Topics INTRODUCE. Subtopics EXPLAIN in detail.`,
      prompt: `You are continuing a study session with a student.

${previousTopics.length > 0 ? `We just covered ${previousTopics.at(-1) ?? ""}. Now let's explore ${topicName}.` : `Let's begin with ${topicName}.`}

TOPIC: ${topicName}
${description ? `DESCRIPTION: ${description}` : ""}

${
  documentContent
    ? `RELEVANT CONTENT FROM YOUR SOURCES:
${documentContent}

YOUR TASK: Write a BRIEF, STRUCTURED TOPIC OVERVIEW (2-3 paragraphs)

STRUCTURE YOUR RESPONSE LIKE THIS:

Paragraph 1 - Context & Introduction:
- Briefly introduce what ${topicName} is about
- Explain why it's important or relevant
${previousTopics.length > 0 ? `- Connect it to what we've learned (${previousTopics.at(-1) ?? ""})` : ""}

Paragraph 2 - What Will Be Covered:
- List the key aspects/subtopics that will be explored
- Mention what the student will learn, but DON'T explain the details
- Use phrases like "We'll explore...", "You'll learn about...", "The subtopics will cover..."
- Keep it as a preview, not an explanation

Paragraph 3 (Optional) - Preview & Invitation:
- Briefly mention why understanding this topic matters
- Invite the student to explore the subtopics for detailed explanations

CRITICAL RULES:
- ✅ DO: Provide a clear, structured overview
- ✅ DO: List what will be covered in subtopics
- ✅ DO: Set context and explain importance
- ❌ DON'T: Explain subtopic details (subtopics do that)
- ❌ DON'T: Provide comprehensive explanations
- ❌ DON'T: List all examples, commands, or specifics
- ❌ DON'T: Write more than 2-3 paragraphs

EXAMPLE - Good Topic Overview:
"Welcome! [Topic Name] is a fundamental concept that focuses on [topic description]. Building on our discussion of [previous topic], this topic will help you understand the core principles and practical applications.

In the subtopics below, we'll explore [list key aspects - e.g., 'time-based greetings, formal vs informal address, common responses, and various ways to say goodbye']. Each aspect will be covered in detail with examples and specific guidance from your source materials.

Understanding [Topic Name] is essential because [brief reason - e.g., 'it forms the foundation for all conversations and demonstrates cultural awareness']. Let's dive into the subtopics to explore each aspect in depth!"

${description ? `Now write a brief overview for "${topicName}" (${description}). Remember: introduce, don't explain. Subtopics will provide the details.` : `Now write a brief overview for "${topicName}". Remember: introduce, don't explain. Subtopics will provide the details.`}`
    : `No source content available.

Write a brief, structured overview (2-3 paragraphs) for "${topicName}"${description ? ` (${description})` : ""} that:
1. Introduces the topic and its importance
2. Lists what will be covered in subtopics (without explaining details)
3. Invites exploration of the subtopics

Keep it concise and engaging - this is an introduction, not a detailed explanation.`
}

Write clearly and conversationally. Structure your response with clear paragraphs. Keep it brief - save the deep dive for the subtopics.`,
    });

    // NOTE: No longer auto-saving explanations to messages
    // Users must manually save explanations they want in their notebook
    // This reduces noise and gives users control over what enters Edit Mode

    return { success: true, explanation: text };
  } catch (error) {
    console.error("Failed to generate topic explanation:", error);
    return {
      success: false,
      explanation: "Failed to generate explanation. Please try again.",
    };
  }
}

type SubtopicExplanationParams = {
  parentTopic: string;
  subtopicName: string;
  description?: string;
  pages: number[];
  documentTitle?: string;
  previousTopics?: string[];
  currentIndex?: number;
  totalTopics?: number;
  documentIds?: string[]; // Add documentIds to fetch actual content
  chatId?: string; // Add chatId to save explanation as message
};

export async function generateSubtopicExplanationAction({
  parentTopic,
  subtopicName,
  description,
  pages: _pages,
  documentTitle: _documentTitle,
  previousTopics: _previousTopics = [],
  currentIndex: _currentIndex,
  totalTopics: _totalTopics,
  documentIds = [],
  chatId,
}: SubtopicExplanationParams) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    // Get actual document content if documentIds are provided
    // Use semantic search instead of page-based fetching to find relevant chunks
    let documentContent = "";
    if (documentIds.length > 0) {
      console.log(
        "🔍 Fetching document content for subtopic explanation using semantic search:",
        {
          parentTopic,
          subtopicName,
          description,
          documentIds,
        }
      );

      try {
        // Create a search query from parent topic, subtopic name, and description
        const searchQuery = description
          ? `${parentTopic} - ${subtopicName}: ${description}`
          : `${parentTopic} - ${subtopicName}`;

        // Use semantic search to find relevant chunks
        // For SUBTOPICS: Use more chunks (20-25) for comprehensive, in-depth explanations
        // Subtopics are where the detailed explanations happen
        const relevantChunks = await retrieveTopK({
          userId: session.user.id,
          docIds: documentIds,
          query: searchQuery,
          k: 22, // Get top 22 chunks for comprehensive, in-depth subtopic explanations
        });

        if (relevantChunks.length > 0) {
          // Get document titles for each chunk (batch fetch for efficiency)
          const uniqueDocumentIds = [
            ...new Set(relevantChunks.map((chunk) => chunk.documentId)),
          ];
          const documentTitleMap = new Map<string, string>();

          // Fetch all document titles in parallel
          await Promise.all(
            uniqueDocumentIds.map(async (documentId) => {
              try {
                const doc = await getDocumentRecordById({ id: documentId });
                documentTitleMap.set(
                  documentId,
                  doc?.title || "Unknown Document"
                );
              } catch (error) {
                console.warn(
                  `Failed to get document title for ${documentId}:`,
                  error
                );
                documentTitleMap.set(documentId, "Unknown Document");
              }
            })
          );

          // Format chunks with document source information
          // Track which documents are being used for better cross-source synthesis
          const chunksByDocumentSub = new Map<string, typeof relevantChunks>();
          for (const chunk of relevantChunks) {
            const docTitle =
              documentTitleMap.get(chunk.documentId) || "Unknown Document";
            if (!chunksByDocumentSub.has(docTitle)) {
              chunksByDocumentSub.set(docTitle, []);
            }
            const existingChunksSub = chunksByDocumentSub.get(docTitle);
            if (existingChunksSub) {
              existingChunksSub.push(chunk);
            }
          }

          documentContent = relevantChunks
            .map((chunk) => {
              const docTitle =
                documentTitleMap.get(chunk.documentId) || "Unknown Document";
              return `[From "${docTitle}", Page ${chunk.page}]: ${chunk.content}`;
            })
            .join("\n\n");

          console.log(
            `✅ Subtopic explanation: Found ${relevantChunks.length} relevant chunks using semantic search`
          );
          const sourceNamesSub = Array.from(chunksByDocumentSub.keys());
          console.log(`📚 Sources used: ${sourceNamesSub.join(", ")}`);
          const chunksPerDocSub = Object.fromEntries(
            Array.from(chunksByDocumentSub.entries()).map(([doc, chunks]) => [
              doc,
              chunks.length,
            ])
          );
          console.log("📊 Chunks per document:", chunksPerDocSub);

          // If multiple sources are available, remind the AI to synthesize
          if (chunksByDocumentSub.size > 1) {
            console.log(
              `🔗 Multiple sources detected - AI should synthesize across: ${sourceNamesSub.join(", ")}`
            );
          }

          console.log(`📄 Sample content: ${documentContent.slice(0, 200)}...`);
        } else {
          console.warn("⚠️ No relevant chunks found using semantic search");
        }
      } catch (searchError) {
        console.warn("⚠️ Semantic search failed:", searchError);
      }
    }

    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      system: `You are an expert AI tutor conducting an in-depth study session. You provide comprehensive, well-structured explanations grounded in the student's source materials.

Key behaviors for SUBTOPIC explanations:
- Provide COMPREHENSIVE, STRUCTURED explanations (5-8 detailed paragraphs)
- This is the DEEP DIVE - be thorough, detailed, and well-organized
- Structure your response with clear sections and logical flow
- When multiple documents are available, SYNTHESIZE across sources - compare, contrast, connect
- Use SPECIFIC examples, quotes, and details from the documents with explicit citations
- Reference document names and page numbers: "[Document Name], page X"
- Explain WHAT, WHY, HOW, and WHERE - not just surface-level facts
- Cover nuances, edge cases, exceptions, and important details
- Show relationships: how this subtopic connects to the parent topic and other concepts
- Use clear formatting: structure with paragraphs, use examples, provide context
- CRITICAL: Base explanations ONLY on provided document content, be comprehensive and structured`,
      prompt: `You are conducting an in-depth study session with a student.

We're exploring "${parentTopic}". Now let's dive deep into: ${subtopicName}

SUBTOPIC: ${subtopicName}
${description ? `DESCRIPTION: ${description}` : ""}
PARENT TOPIC: ${parentTopic}

${
  documentContent
    ? `CONTENT FROM YOUR SOURCES:
${documentContent}

YOUR TASK: Provide a COMPREHENSIVE, WELL-STRUCTURED explanation (5-8 detailed paragraphs)

STRUCTURE YOUR RESPONSE:

1. Opening Paragraph - Context & Connection:
   - Connect this subtopic to the parent topic "${parentTopic}"
   - Explain what this subtopic covers and why it matters
   - Set the stage for the detailed explanation

2. Core Explanation Paragraphs (3-5 paragraphs):
   - Explain the main concepts, principles, and details
   - Use SPECIFIC examples, quotes, and details from the sources
   - Reference sources explicitly: "[Document Name], page X"
   - Explain HOW things work, WHY they matter, WHERE they fit
   - Cover nuances, edge cases, and important details

3. Synthesis Paragraph (if multiple sources):
   - Compare and contrast different perspectives from multiple sources
   - Show where sources agree: "Both [Doc 1] (page X) and [Doc 2] (page Y) explain that..."
   - Show where they differ: "[Doc 1] emphasizes X, while [Doc 2] focuses on Y"
   - Show how they complement: "[Doc 1] provides theory (page X), while [Doc 2] shows practical applications (page Y)"
   - Build a comprehensive understanding by combining information

4. Closing Paragraph - Summary & Connection:
   - Summarize key points
   - Connect back to the parent topic
   - Highlight why this subtopic is important

CITATION FORMAT:
- Always cite sources: "As explained in [Document Name] on page X..."
- When quoting: "The [Document Name] states: '[quote]' (page X)"
- When synthesizing: "Looking at [Doc 1] (page X) and [Doc 2] (page Y), we see that..."

SYNTHESIS ACROSS SOURCES:
If multiple documents discuss this subtopic:
- Compare perspectives: "The [Doc 1] approaches this from X angle, while [Doc 2] focuses on Y"
- Highlight agreements: "Both sources agree that..."
- Note differences: "Where [Doc 1] emphasizes A, [Doc 2] provides additional context about B"
- Show complementarity: "Together, these sources show that [comprehensive understanding]"

EXAMPLE - Good Subtopic Explanation:
"Building on our overview of Spanish greetings, let's explore formal vs. informal greetings in detail. This distinction is fundamental to Spanish communication and reflects the cultural importance of showing appropriate respect.

Formal greetings use the 'usted' form, which shows respect for the person you're addressing. As explained in Beginners-Guide-to-Spanish on page 2, formal greetings include '¿Cómo está usted?' (How are you?) and '¿Cómo le va?' (How's it going?). The same document clarifies on page 6 that 'usted' is reserved for bosses, people older than you, and adults you don't know. This formal address extends beyond just greetings - it affects verb conjugations throughout the conversation.

In contrast, informal greetings use 'tú', which is appropriate for friends, peers, and people younger than you. The Beginners-Guide-to-Spanish on page 2 provides examples like '¿Cómo estás?' (Hello, how are you?) and '¿Cómo te va?' (How's it going?). Notice how the verb forms change: 'está' for formal vs. 'estás' for informal.

When multiple sources discuss this concept, we see consistent explanations. Both the Beginners-Guide-to-Spanish and the Practical Spanish guide emphasize that the choice between 'tú' and 'usted' depends on your relationship with the person and the social context. However, the Practical Spanish guide (page 3) adds practical examples of when to use formal greetings in business settings, showing real-world applications.

Understanding this distinction is crucial because it affects not just greetings, but all verb conjugations and the overall tone of the conversation. Mastering when to use formal vs. informal address is essential for showing cultural awareness and respect in Spanish-speaking contexts."

${description ? `Now provide a comprehensive, structured explanation of "${subtopicName}" (${description}). Use specific examples from your sources, cite them explicitly, and synthesize across multiple sources when available.` : `Now provide a comprehensive, structured explanation of "${subtopicName}". Use specific examples from your sources, cite them explicitly, and synthesize across multiple sources when available.`}`
    : `No source content available.

Provide a comprehensive, structured explanation (5-8 paragraphs) of "${subtopicName}"${description ? ` (${description})` : ""} under "${parentTopic}".
Include:
1. Clear structure and logical flow
2. Specific examples and details
3. Explicit source citations
4. Synthesis of multiple perspectives if applicable
5. Connection to the parent topic

This is the deep dive - be thorough, detailed, and well-organized.`
}

Write clearly and conversationally. Structure your response with clear paragraphs. Use specific examples from your sources and cite them explicitly. If multiple sources are available, synthesize them to provide a comprehensive understanding.`,
    });

    // NOTE: No longer auto-saving explanations to messages
    // Users must manually save explanations they want in their notebook
    // This reduces noise and gives users control over what enters Edit Mode

    return { success: true, explanation: text };
  } catch (error) {
    console.error("Failed to generate subtopic explanation:", error);
    return {
      success: false,
      explanation: "Failed to generate explanation. Please try again.",
    };
  }
}
