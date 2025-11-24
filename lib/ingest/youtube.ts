import { YoutubeTranscript } from "youtube-transcript";

export type TranscriptSegment = {
  text: string;
  start: number;
  duration: number;
};

export type TranscriptChunk = {
  index: number;
  text: string;
  start: number;
};

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/i,
  /youtube\.com\/shorts\/([^&\n?#]+)/i,
];

export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export async function fetchYouTubeTranscript(
  url: string
): Promise<TranscriptSegment[]> {
  const videoId = extractVideoId(url);

  if (!videoId) {
    throw new Error("Invalid YouTube URL provided");
  }

  try {
    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });

    if (!rawTranscript?.length) {
      throw new Error("Transcript is empty or unavailable");
    }

    return rawTranscript
      .map((segment) => ({
        text: segment.text.trim(),
        start: Number(segment.offset ?? segment.start ?? 0),
        duration: Number(segment.duration ?? 0),
      }))
      .filter((segment) => segment.text.length > 0);
  } catch (error) {
    console.error("Failed to fetch YouTube transcript:", error);
    throw new Error(
      "Unable to fetch the transcript for this YouTube video. It may be disabled or unavailable."
    );
  }
}

export function chunkTranscriptSegments(
  segments: TranscriptSegment[],
  targetLength = 600
): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let buffer = "";
  let start = segments[0]?.start ?? 0;

  segments.forEach((segment) => {
    if (!buffer) {
      start = segment.start;
    }
    buffer = buffer ? `${buffer} ${segment.text}` : segment.text;

    if (buffer.length >= targetLength) {
      chunks.push({
        index: chunks.length + 1,
        text: buffer,
        start,
      });
      buffer = "";
    }
  });

  if (buffer) {
    chunks.push({
      index: chunks.length + 1,
      text: buffer,
      start,
    });
  }

  return chunks;
}

export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

