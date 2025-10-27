"use server";

import * as cheerio from "cheerio";
import { generateObject } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import type { ProcessedContent } from "./process-content";

const WebsiteAnalysisSchema = z.object({
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

export async function processWebsite(url: string, title?: string): Promise<ProcessedContent> {
  // Validate URL
  if (!isValidWebsiteUrl(url)) {
    throw new Error("Invalid website URL");
  }

  try {
    // Fetch the webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract main content
    const extractedContent = extractMainContent($);
    
    if (!extractedContent || extractedContent.trim().length < 100) {
      throw new Error("Unable to extract meaningful content from the webpage");
    }

    // Generate AI-powered analysis
    const analysis = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: WebsiteAnalysisSchema,
      prompt: `Analyze the following webpage content and extract key information:

URL: ${url}
Content:
${extractedContent}

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
      content: extractedContent,
      metadata: {
        type: "link",
        source: url,
        summary: analysis.object.summary,
        topics: analysis.object.topics,
        readingTime: analysis.object.readingTime,
        difficulty: analysis.object.difficulty,
        category: analysis.object.category,
        wordCount: extractedContent.split(' ').length,
      },
    };
  } catch (error) {
    console.error("Error processing website:", error);
    throw new Error(`Failed to process website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to extract main content from HTML
function extractMainContent($: cheerio.CheerioAPI): string {
  // Remove script and style elements
  $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar').remove();
  
  // Try to find the main content area
  let mainContent = '';
  
  // Common selectors for main content
  const contentSelectors = [
    'main',
    'article',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.main-content',
    '#content',
    '#main',
    '.container .row .col',
    'body'
  ];
  
  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > mainContent.length) {
        mainContent = text;
      }
    }
  }
  
  // Clean up the text
  return mainContent
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
    .trim();
}

// Helper function to validate website URL
function isValidWebsiteUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}
