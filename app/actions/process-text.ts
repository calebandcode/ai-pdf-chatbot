"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import type { ProcessedContent } from "./process-content";

const TextAnalysisSchema = z.object({
  title: z.string().describe("A clear, descriptive title for the content"),
  summary: z.string().describe("A comprehensive summary of the main points"),
  topics: z.array(z.object({
    topic: z.string().describe("The topic name"),
    description: z.string().describe("Brief description of what this topic covers"),
    keyPoints: z.array(z.string()).describe("3-5 key points for this topic")
  })).describe("Main topics covered in the content"),
  readingTime: z.number().describe("Estimated reading time in minutes"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("Content difficulty level"),
  category: z.string().describe("Content category (e.g., 'Education', 'Technology', 'Business')")
});

export async function processText(text: string, title?: string): Promise<ProcessedContent> {
  // Validate text content
  if (!isValidTextContent(text)) {
    throw new Error("Invalid text content");
  }

  // Clean and format the text
  const cleanedText = cleanText(text);
  
  // Generate AI-powered analysis
  const analysis = await generateObject({
    model: myProvider.languageModel("chat-model"),
    schema: TextAnalysisSchema,
    prompt: `Analyze the following text content and extract key information:

${cleanedText}

Please provide:
1. A clear, descriptive title
2. A comprehensive summary of the main points
3. Main topics with descriptions and key points
4. Estimated reading time
5. Difficulty level
6. Content category

Focus on creating educational value and clear learning structure.`,
  });

  return {
    title: title || analysis.object.title,
    content: cleanedText,
    metadata: {
      type: "text",
      summary: analysis.object.summary,
      topics: analysis.object.topics,
      readingTime: analysis.object.readingTime,
      difficulty: analysis.object.difficulty,
      category: analysis.object.category,
      wordCount: cleanedText.split(' ').length,
    },
  };
}

// Helper function to validate text content
async function isValidTextContent(text: string): Promise<boolean> {
  return text.trim().length > 0 && text.length <= 50000;
}

function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n'); // Normalize line breaks
}

function generateTitleFromText(text: string): string {
  // Extract first sentence or first 50 characters as title
  const firstSentence = text.split('.')[0];
  if (firstSentence.length <= 50) {
    return firstSentence.trim();
  }
  
  // If first sentence is too long, take first 50 characters
  return text.substring(0, 50).trim() + '...';
}
