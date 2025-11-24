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

const FETCH_TIMEOUT_MS = 30000; // 30 seconds timeout
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000; // 1 second delay between retries

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms. The website may be slow or unreachable.`);
    }
    throw error;
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      if (!response.ok) {
        // Don't retry on client errors (4xx) except 408, 429
        if (response.status >= 400 && response.status < 500 && 
            response.status !== 408 && response.status !== 429) {
          throw new Error(
            `Failed to fetch webpage: ${response.status} ${response.statusText}. ` +
            `The website may not allow access or the URL may be incorrect.`
          );
        }
        // Retry on server errors (5xx) and specific client errors
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }
        throw new Error(
          `Failed to fetch webpage after ${maxRetries + 1} attempts: ${response.status} ${response.statusText}`
        );
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on timeout or invalid URL errors
      if (
        lastError.message.includes("timed out") ||
        lastError.message.includes("Invalid URL") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("ENOTFOUND")
      ) {
        throw lastError;
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        console.warn(`Fetch attempt ${attempt + 1} failed, retrying...`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error("Failed to fetch webpage after multiple attempts");
}

export async function processWebsite(url: string, title?: string): Promise<ProcessedContent> {
  // Validate URL
  if (!isValidWebsiteUrl(url)) {
    throw new Error("Invalid website URL. Please provide a valid HTTP or HTTPS URL.");
  }

  try {
    // Fetch the webpage content with timeout and retry logic
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract main content
    let extractedContent = extractMainContent($);
    
    if (!extractedContent || extractedContent.trim().length < 100) {
      throw new Error("Unable to extract meaningful content from the webpage. The page may be mostly images, videos, or require JavaScript to load content.");
    }

    // Truncate content to avoid token limits and safety filter issues
    // Keep content under ~3000 tokens (roughly 12,000 characters)
    const MAX_CONTENT_LENGTH = 12000;
    if (extractedContent.length > MAX_CONTENT_LENGTH) {
      extractedContent = extractedContent.substring(0, MAX_CONTENT_LENGTH) + "...\n[Content truncated due to length]";
    }

    // Generate AI-powered analysis with error handling for blocked content
    let analysis;
    try {
      analysis = await generateObject({
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
    } catch (aiError: unknown) {
      // Handle ALL AI errors by falling back to non-AI analysis
      // This covers: blocked content, invalid JSON, API errors, etc.
      const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
      console.warn("AI analysis failed, using fallback analysis:", errorMessage);
      
      // Always use fallback when AI fails - better than failing completely
      analysis = {
        object: {
          title: title || extractTitle($) || new URL(url).hostname.replace('www.', ''),
          summary: generateFallbackSummary(extractedContent),
          topics: extractTopicsFallback(extractedContent),
          readingTime: Math.ceil(extractedContent.split(/\s+/).length / 200), // ~200 words per minute
          difficulty: "intermediate" as const,
          category: "General",
        },
      };
    }

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide more specific error messages
    if (errorMessage.includes("timed out")) {
      throw new Error(
        "The website took too long to respond. Please try again or check if the URL is correct."
      );
    }
    if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
      throw new Error(
        "Unable to connect to the website. Please check the URL and try again."
      );
    }
    if (errorMessage.includes("Invalid website URL")) {
      throw new Error(
        "Invalid website URL. Please provide a valid HTTP or HTTPS URL."
      );
    }
    if (errorMessage.includes("Unable to extract meaningful content")) {
      throw new Error(
        "Unable to extract meaningful content from the webpage. The page may require JavaScript to load content or may be mostly images/videos."
      );
    }
    
    throw new Error(
      `Failed to process website: ${errorMessage}. Please try again or contact support if the issue persists.`
    );
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

// Helper function to extract title from HTML
function extractTitle($: cheerio.CheerioAPI): string {
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() ||
                $('meta[property="og:title"]').attr('content')?.trim() ||
                '';
  return title.length > 100 ? title.substring(0, 100) + '...' : title;
}

// Fallback summary generation when AI is blocked
function generateFallbackSummary(content: string): string {
  if (!content || content.trim().length === 0) {
    return "Content extracted from webpage. Please review the full content for details.";
  }
  
  // Try to extract meaningful sentences
  const sentences = content.split(/[.!?]+\s+/).filter(s => s.trim().length > 20);
  
  if (sentences.length === 0) {
    // Fallback: use first paragraph or first 500 chars
    const firstParagraph = content.split('\n\n')[0] || content.split('\n')[0] || content;
    return firstParagraph.length > 500 
      ? firstParagraph.substring(0, 500) + '...'
      : firstParagraph || "Content extracted from webpage. Please review the full content for details.";
  }
  
  const firstFewSentences = sentences.slice(0, 3).join(' ');
  return firstFewSentences.length > 500 
    ? firstFewSentences.substring(0, 500) + '...'
    : firstFewSentences || "Content extracted from webpage. Please review the full content for details.";
}

// Fallback topic extraction when AI is blocked
function extractTopicsFallback(content: string): Array<{
  topic: string;
  description: string;
  keyPoints: string[];
}> {
  // Extract headings and first paragraphs as topics
  const lines = content.split('\n').filter(line => line.trim().length > 10);
  const topics: Array<{
    topic: string;
    description: string;
    keyPoints: string[];
  }> = [];

  // Look for potential headings (lines that are short and likely headings)
  let currentTopic: string | null = null;
  let topicContent: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    
    // If line is short and uppercase or starts with number, might be a heading
    if (line.length < 100 && (line.toUpperCase() === line || /^\d+[.)]\s/.test(line))) {
      if (currentTopic && topicContent.length > 0) {
        topics.push({
          topic: currentTopic,
          description: topicContent.slice(0, 2).join(' ').substring(0, 200),
          keyPoints: topicContent.slice(0, 3).map(p => p.substring(0, 100)),
        });
      }
      currentTopic = line;
      topicContent = [];
    } else if (currentTopic) {
      topicContent.push(line);
    }
  }

  // Add last topic
  if (currentTopic && topicContent.length > 0) {
    topics.push({
      topic: currentTopic,
      description: topicContent.slice(0, 2).join(' ').substring(0, 200),
      keyPoints: topicContent.slice(0, 3).map(p => p.substring(0, 100)),
    });
  }

  // If no topics found, create a generic one
  if (topics.length === 0) {
    const wordCount = content.split(/\s+/).length;
    const keyPoints = lines
      .slice(0, 5)
      .filter(l => l.trim().length > 20)
      .map(l => l.substring(0, 100).trim())
      .filter(Boolean);
    
    // Ensure we have at least one key point
    if (keyPoints.length === 0) {
      keyPoints.push("Content extracted from webpage");
    }
    
    topics.push({
      topic: "Main Content",
      description: `Extracted ${wordCount} words from the webpage.`,
      keyPoints,
    });
  }

  // Ensure each topic has at least one key point
  return topics.slice(0, 5).map(topic => ({
    ...topic,
    keyPoints: topic.keyPoints.length > 0 
      ? topic.keyPoints 
      : [topic.description || "Content available"],
  }));
}
