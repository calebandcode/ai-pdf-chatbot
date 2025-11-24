"use server";

import type { ProcessedContent } from "./process-content";
import {
  chunkTranscriptSegments,
  extractVideoId,
  fetchYouTubeTranscript,
  formatTimestamp,
} from "@/lib/ingest/youtube";

export async function processYouTube(
  url: string,
  title?: string
): Promise<ProcessedContent> {
  const segments = await fetchYouTubeTranscript(url);
  const chunked = chunkTranscriptSegments(segments);

  const combinedTranscript = segments
    .map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join("\n\n");

  const wordCount = combinedTranscript.split(/\s+/).filter(Boolean).length;
  const durationSeconds =
    (segments.at(-1)?.start ?? 0) + (segments.at(-1)?.duration ?? 0);
  const videoId = extractVideoId(url);

  return {
    title: title || `YouTube Video${videoId ? `: ${videoId}` : ""}`,
    content: combinedTranscript,
    metadata: {
      type: "youtube",
      source: url,
      readingTime: Math.ceil(wordCount / 200),
      wordCount,
      durationSeconds,
      segments: chunked.map((chunk) => ({
        start: chunk.start,
        timestamp: formatTimestamp(chunk.start),
        text: chunk.text,
      })),
    },
  };
}
