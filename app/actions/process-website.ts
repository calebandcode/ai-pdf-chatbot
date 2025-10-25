"use server";

import type { ProcessedContent } from "./process-content";

export async function processWebsite(url: string, title?: string): Promise<ProcessedContent> {
  // Validate URL
  if (!isValidWebsiteUrl(url)) {
    throw new Error("Invalid website URL");
  }

  // Mock scraped content for now - in production, you'd use a web scraping service
  const mockContent = `This is mock content scraped from ${url}.

The webpage contains valuable information about various topics including:

1. Main Topic Overview
   - Key concepts and definitions
   - Important background information
   - Context and relevance

2. Detailed Analysis
   - In-depth explanations
   - Supporting evidence and examples
   - Different perspectives and viewpoints

3. Practical Applications
   - Real-world use cases
   - Implementation strategies
   - Best practices and recommendations

4. Conclusion
   - Summary of key points
   - Future implications
   - Additional resources and references

This content has been processed and formatted for easy reading and comprehension.`;

  return {
    title: title || `Website Content: ${new URL(url).hostname}`,
    content: mockContent,
    metadata: {
      type: "link",
      source: url,
      readingTime: Math.ceil(mockContent.split(' ').length / 200), // ~200 words per minute
    },
  };
}

// Helper function to validate website URL
async function isValidWebsiteUrl(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}
