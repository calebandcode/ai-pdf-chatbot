"use server";

import type { ProcessedContent } from "./process-content";

export async function processYouTube(url: string, title?: string): Promise<ProcessedContent> {
  // Extract video ID from URL
  const videoId = extractVideoId(url);
  
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  // Mock transcript for now - in production, you'd use YouTube API
  const mockTranscript = `This is a mock transcript for YouTube video ${videoId}. 
  
In this video, we cover important topics including:
- Introduction to the main concepts
- Detailed explanations with examples
- Practical applications
- Key takeaways and conclusions

The video provides comprehensive coverage of the subject matter and includes real-world examples to help viewers understand the concepts better.`;

  return {
    title: title || `YouTube Video: ${videoId}`,
    content: mockTranscript,
    metadata: {
      type: "youtube",
      source: url,
      readingTime: Math.ceil(mockTranscript.split(' ').length / 200), // ~200 words per minute
    },
  };
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
