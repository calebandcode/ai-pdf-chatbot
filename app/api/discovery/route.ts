import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { fetchSerperArticles, fetchSerperImages, fetchSerperVideos } from "@/lib/discovery/serper";
import { buildDiscoveryKeywords } from "@/lib/discovery/keywords";
import { fetchWikiSummary } from "@/lib/discovery/wiki";
import type { DiscoveryResponse, DiscoverySections } from "@/lib/discovery/types";

const requestSchema = z.object({
  documentId: z.string(),
  documentTitle: z.string(),
  summary: z.string().optional(),
  topics: z
    .array(
      z.object({
        topic: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
});

const cache = new Map<string, { expiresAt: number; data: DiscoveryResponse }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = requestSchema.parse(await request.json());
    const keywords =
      buildDiscoveryKeywords({
        documentTitle: body.documentTitle,
        summary: body.summary,
        topics: body.topics,
        maxKeywords: 5,
      }) || [];

    const normalizedKeywords = keywords.length
      ? keywords
      : [body.documentTitle].filter(Boolean);

    const cacheKey = `${body.documentId}:${normalizedKeywords.join("|")}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const primaryQuery = normalizedKeywords[0] || body.documentTitle;
    const secondaryQuery = normalizedKeywords[1] || primaryQuery;

    const [articles, videos, images, wikiOne, wikiTwo] = await Promise.all([
      fetchSerperArticles(primaryQuery),
      fetchSerperVideos(`${primaryQuery} tutorial`),
      fetchSerperImages(secondaryQuery),
      fetchWikiSummary(primaryQuery),
      normalizedKeywords[1] ? fetchWikiSummary(normalizedKeywords[1]) : null,
    ]);

    const wikiItems = [wikiOne, wikiTwo].filter(Boolean);

    const sections: DiscoverySections = {
      articles,
      videos,
      images,
      wiki: wikiItems as NonNullable<typeof wikiOne>[],
    };

    const responsePayload: DiscoveryResponse = {
      keywords: normalizedKeywords,
      sections,
      fetchedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: responsePayload,
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("[discovery] failed to fetch resources", error);
    return NextResponse.json(
      { error: "Failed to fetch discovery resources" },
      { status: 500 }
    );
  }
}
