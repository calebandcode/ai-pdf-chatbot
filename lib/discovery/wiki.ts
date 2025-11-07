import type { DiscoveryItem } from "./types";

export async function fetchWikiSummary(
  topic: string
): Promise<DiscoveryItem | null> {
  if (!topic) {
    return null;
  }

  const slug = encodeURIComponent(topic.trim());
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
    {
      headers: {
        "User-Agent": "ai-pdf-chatbot/1.0",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    title?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
  };

  if (!data?.title || !data.extract) {
    return null;
  }

  return {
    id: `wiki-${slug}`,
    type: "wiki",
    title: data.title,
    description: data.extract,
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${slug}`,
    thumbnail: data.thumbnail?.source,
    source: "Wikipedia",
  };
}
