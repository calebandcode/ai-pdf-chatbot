import type { DiscoveryItem } from "./types";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_BASE_URL = "https://google.serper.dev";

type SerperSearchResponse = {
  organic?: Array<{
    title: string;
    link: string;
    snippet?: string;
    date?: string;
    source?: string;
  }>;
  knowledgeGraph?: {
    description?: string;
  };
  videos?: Array<{
    title: string;
    link: string;
    platform?: string;
    channel?: string;
    date?: string;
    imageUrl?: string;
  }>;
};

type SerperImageResponse = {
  images?: Array<{
    title?: string;
    imageUrl: string;
    source?: string;
    link?: string;
  }>;
};

async function callSerper<T>(endpoint: string, payload: Record<string, unknown>) {
  if (!SERPER_API_KEY) {
    return null;
  }

  const response = await fetch(`${SERPER_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    console.warn(
      "[discovery] Serper request failed",
      endpoint,
      response.status,
      await response.text()
    );
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchSerperArticles(
  query: string,
  limit = 4
): Promise<DiscoveryItem[]> {
  const results = await callSerper<SerperSearchResponse>("search", {
    q: query,
    num: limit,
  });

  if (!results?.organic) {
    return [];
  }

  return results.organic.slice(0, limit).map((item, index) => ({
    id: `article-${index}-${item.link}`,
    type: "article",
    title: item.title,
    url: item.link,
    description: item.snippet || results.knowledgeGraph?.description,
    source: item.source || "Serper",
    publishedAt: item.date,
  }));
}

export async function fetchSerperVideos(
  query: string,
  limit = 3
): Promise<DiscoveryItem[]> {
  const results = await callSerper<SerperSearchResponse>("search", {
    q: `${query} tutorial`,
    num: limit,
  });

  if (!results?.videos) {
    return [];
  }

  return results.videos.slice(0, limit).map((video, index) => ({
    id: `video-${index}-${video.link}`,
    type: "video",
    title: video.title,
    url: video.link,
    description: video.platform || video.channel || "Video",
    thumbnail: video.imageUrl,
    source: video.channel || video.platform,
    publishedAt: video.date,
  }));
}

export async function fetchSerperImages(
  query: string,
  limit = 4
): Promise<DiscoveryItem[]> {
  const results = await callSerper<SerperImageResponse>("images", {
    q: query,
    num: limit,
  });

  if (!results?.images) {
    return [];
  }

  return results.images.slice(0, limit).map((image, index) => ({
    id: `image-${index}-${image.imageUrl}`,
    type: "image",
    title: image.title || query,
    url: image.link || image.imageUrl,
    thumbnail: image.imageUrl,
    source: image.source || "Serper Images",
  }));
}
