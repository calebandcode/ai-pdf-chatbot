"use server";

import { processYouTube } from "./process-youtube";
import { processWebsite } from "./process-website";
import { processText } from "./process-text";

export type ContentType = "pdf" | "link" | "youtube" | "text";

export interface ProcessContentParams {
  contentType: ContentType;
  content: string;
  title?: string;
}

export interface ProcessedContent {
  title: string;
  content: string;
  metadata?: {
    type: ContentType;
    source?: string;
    readingTime?: number;
  };
}

export async function processContent(params: ProcessContentParams): Promise<{
  success: boolean;
  data?: ProcessedContent;
  error?: string;
}> {
  try {
    const { contentType, content, title } = params;

    // Validate content
    const validation = await validateContent(contentType, content);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    let result: ProcessedContent;

    switch (contentType) {
      case "youtube":
        result = await processYouTube(content, title);
        break;
      case "link":
        result = await processWebsite(content, title);
        break;
      case "text":
        result = await processText(content, title);
        break;
      case "pdf":
        return { success: false, error: "PDF processing should be handled via file upload" };
      default:
        return { success: false, error: `Unsupported content type: ${contentType}` };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Error processing content:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to process content" 
    };
  }
}

// Helper function to validate content before processing
async function validateContent(contentType: string, content: string): Promise<{ valid: boolean; error?: string }> {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "Content cannot be empty" };
  }

  switch (contentType) {
    case "youtube":
      if (!content.includes("youtube.com") && !content.includes("youtu.be")) {
        return { valid: false, error: "Invalid YouTube URL" };
      }
      break;
    case "link":
      if (!content.startsWith("http://") && !content.startsWith("https://")) {
        return { valid: false, error: "Invalid URL format" };
      }
      break;
    case "text":
      if (content.length < 10) {
        return { valid: false, error: "Text content is too short" };
      }
      if (content.length > 50000) {
        return { valid: false, error: "Text content is too long" };
      }
      break;
    case "pdf":
      return { valid: false, error: "PDF processing should be handled via file upload" };
    default:
      return { valid: false, error: `Unsupported content type: ${contentType}` };
  }

  return { valid: true };
}

// Helper function to create a chat with processed content
export async function createChatWithContent(content: ProcessedContent): Promise<{
  success: boolean;
  data?: { chatId: string };
  error?: string;
}> {
  try {
    // For now, return a mock success response
    // In a real implementation, this would create a chat in the database
    return {
      success: true,
      data: {
        chatId: `chat-${Date.now()}`,
      },
    };
  } catch (error) {
    console.error("Error creating chat with content:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create chat",
    };
  }
}
