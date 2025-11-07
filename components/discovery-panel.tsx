"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Youtube,
} from "lucide-react";
import type { DiscoveryItem, DiscoveryResponse } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

type DiscoveryPanelProps = {
  data?: DiscoveryResponse | null;
  isLoading?: boolean;
  isError?: boolean;
};

const sectionConfig: Record<
  keyof DiscoveryResponse["sections"],
  { title: string; icon: React.ReactNode }
> = {
  articles: {
    title: "",
    icon: null,
  },
  videos: {
    title: "Videos",
    icon: <Youtube className="h-4 w-4" />,
  },
  images: {
    title: "Visual References",
    icon: <ImageIcon className="h-4 w-4" />,
  },
  wiki: {
    title: "Wikipedia Snapshot",
    icon: <BookOpen className="h-4 w-4" />,
  },
};

export function DiscoveryPanel({
  data,
  isLoading,
  isError,
}: DiscoveryPanelProps) {
  const visibleSections: Array<keyof DiscoveryResponse["sections"]> = [
    "articles",
    "videos",
  ];
  const hasContent =
    data &&
    visibleSections.some((sectionKey) => data.sections[sectionKey]?.length > 0);

  if (!isLoading && !isError && !hasContent) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white/70 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">
              Related Discoveries
            </p>
            <p className="text-muted-foreground text-xs">
              Curated recommendations based on your document
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              className="h-16 animate-pulse rounded-lg bg-muted/50"
              key={index}
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg bg-destructive/5 p-3 text-destructive text-sm">
          Something went wrong while fetching discoveries. Please try again.
        </div>
      )}

      {!isLoading && hasContent && data && (
        <div className="space-y-4">
          {visibleSections.map((sectionKey) => {
            const items = data.sections[sectionKey];
            if (!items || items.length === 0) {
              return null;
            }
            const config = sectionConfig[sectionKey];
            return (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 10 }}
                key={sectionKey}
                transition={{ duration: 0.25 }}
              >
                {config.title && (
                  <div className="mb-2 flex items-center gap-2 font-medium text-foreground text-sm">
                    {config.icon && (
                      <span className="text-primary">{config.icon}</span>
                    )}
                    {config.title}
                  </div>
                )}
                <div
                  className={cn("gap-2", {
                    "flex flex-col": sectionKey === "articles",
                    "grid sm:grid-cols-2": sectionKey !== "articles",
                  })}
                >
                  {items.map((item) => (
                    <DiscoveryCard item={item} key={item.id} />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiscoveryCard({ item }: { item: DiscoveryItem }) {
  const hasThumbnail = Boolean(item.thumbnail);
  return (
    <motion.a
      className="group flex items-start gap-3 rounded-lg border border-border/60 bg-white/80 p-3 transition-shadow hover:shadow-md"
      href={item.url}
      rel="noreferrer"
      target="_blank"
      whileHover={{ y: -1 }}
    >
      {hasThumbnail ? (
        <div className="relative mt-0.5 h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {/* biome-ignore lint/a11y/useAltText: decorative thumbnail */}
          <img
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
            src={item.thumbnail as string}
          />
        </div>
      ) : (
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="flex-1">
        <p className="line-clamp-1 font-medium text-foreground text-sm">
          {item.title}
        </p>
        {item.description && (
          <p className="line-clamp-2 text-muted-foreground text-xs">
            {item.description}
          </p>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground/70 uppercase tracking-wide">
          {item.source || item.type.toUpperCase()}
        </div>
      </div>
    </motion.a>
  );
}
