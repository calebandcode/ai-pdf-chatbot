import type { PdfPageText } from "./pdf";

export type PageChunk = {
  page: number;
  content: string;
};

export type ChunkOptions = {
  minLength?: number;
  maxLength?: number;
  overlap?: number;
};

const DEFAULT_MIN_LENGTH = 800;
const DEFAULT_MAX_LENGTH = 1200;
const DEFAULT_OVERLAP = 200;

const WHITESPACE_REGEX = /\s+/g;

function sanitize(text: string) {
  return text.replace(WHITESPACE_REGEX, " ").trim();
}

function chunkText(
  text: string,
  { minLength, maxLength, overlap }: Required<ChunkOptions>
): string[] {
  const clean = sanitize(text);

  if (!clean) {
    return [];
  }

  if (clean.length <= maxLength) {
    return [clean];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + maxLength, clean.length);

    if (end < clean.length) {
      const windowStart = start + minLength;
      const breakpoint = clean.lastIndexOf(" ", end);

      if (breakpoint > windowStart) {
        end = breakpoint;
      }
    }

    const slice = clean.slice(start, end).trim();
    if (slice) {
      chunks.push(slice);
    }

    if (end >= clean.length) {
      break;
    }

    start = Math.max(end - overlap, 0);
  }

  return chunks;
}

export function chunkPages(
  pages: PdfPageText[],
  options: ChunkOptions = {}
): PageChunk[] {
  const resolvedOptions: Required<ChunkOptions> = {
    minLength: options.minLength ?? DEFAULT_MIN_LENGTH,
    maxLength: options.maxLength ?? DEFAULT_MAX_LENGTH,
    overlap: options.overlap ?? DEFAULT_OVERLAP,
  };

  return pages.flatMap((page) => {
    const pageChunks = chunkText(page.text, resolvedOptions);

    return pageChunks.map<PageChunk>((content) => ({
      page: page.page,
      content,
    }));
  });
}
