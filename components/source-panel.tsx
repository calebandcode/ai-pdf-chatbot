"use client";

import { FileText, LinkIcon, Plus, Type, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

export type SourceType = "pdf" | "link" | "youtube" | "text" | "unknown";

export type DocumentSourceMeta = {
  id: string;
  title: string;
  type: SourceType;
  summary?: string;
  pageCount?: number;
  addedAt?: string;
  origin?: "message" | "record";
};

type SourcesCardProps = {
  sources: DocumentSourceMeta[];
  isLoading: boolean;
  onAddSource: () => void;
  disabled?: boolean;
};

type SourcesRailProps = SourcesCardProps;

const SOURCE_META: Record<
  SourceType,
  { label: string; icon: typeof FileText }
> = {
  pdf: { label: "PDF", icon: FileText },
  link: { label: "Link", icon: LinkIcon },
  youtube: { label: "YouTube", icon: Youtube },
  text: { label: "Text", icon: Type },
  unknown: { label: "Source", icon: FileText },
};

const formatMetaLine = (source: DocumentSourceMeta) => {
  const pieces: string[] = [];
  const meta = SOURCE_META[source.type];
  if (meta) {
    pieces.push(meta.label);
  }
  if (source.pageCount && source.pageCount > 0) {
    pieces.push(
      `${source.pageCount} ${source.pageCount === 1 ? "page" : "pages"}`
    );
  }
  if (source.addedAt) {
    const date = new Date(source.addedAt);
    if (!Number.isNaN(date.getTime())) {
      pieces.push(
        date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      );
    }
  }
  return pieces.join(" · ");
};

const SourceListItem = ({
  source,
  className,
}: {
  source: DocumentSourceMeta;
  className?: string;
}) => {
  const Icon = SOURCE_META[source.type]?.icon ?? FileText;
  const metaLine = formatMetaLine(source);
  return (
    <div
      className={cn(
        "rounded bg-background/85 p-3 transition hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground text-sm">
            {source.title || "Untitled"}
          </p>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({
  isLoading,
  message = "Attach PDFs, links, or text to ground this chat.",
}: {
  isLoading: boolean;
  message?: string;
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            className="h-20 animate-pulse rounded-xl bg-muted/70"
            key={`source-skeleton-${index}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 border-dashed p-4 text-center text-muted-foreground text-xs">
      {message}
    </div>
  );
};

export function SourcesCard({
  sources,
  isLoading,
  onAddSource,
  disabled = false,
}: SourcesCardProps) {
  return (
    <div className="w-80 rounded-2xl pr-5">
      <div className="mb-4">
        <p className="font-semibold text-foreground text-sm">Sources</p>
        <p className="text-muted-foreground text-xs">
          {sources.length
            ? `${sources.length} linked ${
                sources.length === 1 ? "source" : "sources"
              }`
            : "Keep adding context as you study"}
        </p>
      </div>

      <div className="space-y-3">
        {sources.length === 0 ? (
          <EmptyState isLoading={isLoading} />
        ) : (
          sources.map((source) => (
            <SourceListItem key={source.id} source={source} />
          ))
        )}
      </div>

      {/* Add button below sources - same width and styling */}
      <button
        className="mt-20 flex w-full items-center justify-center gap-2 rounded border border-border/60 bg-background/85 p-3 font-medium text-primary text-sm transition hover:cursor-pointer hover:border-primary/30 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onAddSource}
        type="button"
      >
        <Plus className="size-4" />
        Add Source
      </button>
    </div>
  );
}

export function SourcesRail({
  sources,
  isLoading,
  onAddSource,
  disabled = false,
}: SourcesRailProps) {
  if (!sources.length && !isLoading) {
    return null;
  }

  return (
    <div className="g-muted/30 px-4 py-3 lg:hidden">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Sources
        </p>
        <button
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-1 font-medium text-primary text-xs transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={onAddSource}
          type="button"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {sources.length === 0 ? (
          <EmptyState
            isLoading={isLoading}
            message="Analyzing your uploads..."
          />
        ) : (
          sources.map((source) => (
            <SourceListItem
              className="min-w-[220px] flex-shrink-0"
              key={source.id}
              source={source}
            />
          ))
        )}
      </div>
    </div>
  );
}
