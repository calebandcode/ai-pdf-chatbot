import type { DiscoveryTopic } from "./types";

const STOP_WORDS = new Set(
  [
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "your",
    "what",
    "this",
    "into",
    "about",
    "into",
    "using",
    "step",
    "guide",
    "introduction",
    "basics",
  ].map((word) => word.toLowerCase())
);

function normalizePhrase(phrase?: string) {
  if (!phrase) {
    return null;
  }
  const cleaned = phrase
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 4)
    .join(" ")
    .trim();
  return cleaned || null;
}

export function buildDiscoveryKeywords({
  documentTitle,
  summary,
  topics,
  maxKeywords = 5,
}: {
  documentTitle: string;
  summary?: string;
  topics?: DiscoveryTopic[];
  maxKeywords?: number;
}): string[] {
  const keywords = new Set<string>();

  const addCandidate = (candidate?: string | null) => {
    if (!candidate) {
      return;
    }
    const cleaned = candidate.trim();
    if (!cleaned) {
      return;
    }
    keywords.add(capitalize(cleaned));
  };

  addCandidate(normalizePhrase(documentTitle));

  topics?.forEach((topic) => {
    addCandidate(normalizePhrase(topic.topic));
    addCandidate(normalizePhrase(topic.description));
  });

  if (summary) {
    const highlighted = summary
      .split(/[.]/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)
      .slice(0, 3);

    highlighted.forEach((sentence) => {
      const candidate = sentence
        .split(/\bincludes\b|\bexplores\b|\bcovers\b/)[0]
        .split(",")[0];
      addCandidate(normalizePhrase(candidate));
    });
  }

  return Array.from(keywords).slice(0, maxKeywords);
}

function capitalize(value: string) {
  return value
    .split(" ")
    .map((segment) =>
      segment.length > 1
        ? segment[0].toUpperCase() + segment.slice(1)
        : segment.toUpperCase()
    )
    .join(" ");
}
