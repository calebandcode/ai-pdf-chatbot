"use client";

import { Fragment, useMemo } from "react";
import type { DocumentSummary } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type TopicNode = NonNullable<DocumentSummary["mainTopics"]>[number];

export function KnowledgeOverview({
  summary,
  topics,
  className,
}: {
  summary: string;
  topics: TopicNode[];
  className?: string;
}) {
  const trimmedSummary = summary.trim();

  const hasTopics = topics.length > 0;

  return (
    <section
      className={cn(
        "mb-4 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Knowledge overview
      </p>
      {trimmedSummary && (
        <p className="mt-2 text-sm leading-6 text-foreground">{trimmedSummary}</p>
      )}

      {hasTopics && (
        <div className="mt-4 space-y-3">
          {topics.map((topic) => (
            <TopicSection key={topic.topic} topic={topic} />
          ))}
        </div>
      )}
    </section>
  );
}

function TopicSection({ topic }: { topic: TopicNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-foreground">
            {topic.topic}
          </p>
          {topic.description && (
            <p className="text-muted-foreground text-sm">{topic.description}</p>
          )}
        </div>
        {topic.pages?.length ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {topic.pages.length} page{topic.pages.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {topic.subtopics?.length ? (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {topic.subtopics.map((sub) => (
            <li key={`${topic.topic}-${sub.subtopic}`}>
              <span className="font-medium text-foreground">
                {sub.subtopic}
              </span>
              {(sub as { description?: string }).description ? ` — ${(sub as { description?: string }).description}` : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
