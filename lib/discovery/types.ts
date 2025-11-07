export type DiscoveryItemType = "article" | "video" | "image" | "wiki";

export type DiscoveryItem = {
  id: string;
  type: DiscoveryItemType;
  title: string;
  url: string;
  description?: string;
  thumbnail?: string;
  source?: string;
  publishedAt?: string;
  author?: string;
  extra?: Record<string, unknown>;
};

export type DiscoverySections = {
  articles: DiscoveryItem[];
  videos: DiscoveryItem[];
  images: DiscoveryItem[];
  wiki: DiscoveryItem[];
};

export type DiscoveryResponse = {
  keywords: string[];
  sections: DiscoverySections;
  fetchedAt: string;
};

export type DiscoveryTopic = {
  topic: string;
  description?: string;
};
