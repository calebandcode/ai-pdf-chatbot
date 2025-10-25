"use server";

import type { ProcessedContent } from "./process-content";

export async function processText(text: string, title?: string): Promise<ProcessedContent> {
  // Validate text content
  if (!isValidTextContent(text)) {
    throw new Error("Invalid text content");
  }

  // Clean and format the text
  const cleanedText = cleanText(text);
  
  // Generate a title if not provided
  const generatedTitle = title || generateTitleFromText(cleanedText);

  return {
    title: generatedTitle,
    content: cleanedText,
    metadata: {
      type: "text",
      readingTime: Math.ceil(cleanedText.split(' ').length / 200), // ~200 words per minute
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
