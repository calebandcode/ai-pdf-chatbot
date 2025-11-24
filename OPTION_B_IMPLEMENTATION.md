# Option B Implementation Plan

## Overview

Switch from Option A (merge & regenerate) to Option B (contextual only):
- Remove expensive AI merging when adding sources
- Just append sources to array
- Edit Mode groups topics simply (no AI)
- Consolidate all Agent Mode interactions (explanations, Q&A, flashcards, quizzes)

---

## Step 1: Create Helper Functions

### 1.1 Create `lib/blocknote/topic-grouping.ts`

**Purpose:** Simple topic grouping (no AI merging)

```typescript
import type { ChatContext } from "@/lib/db/schema";

export type TopicNode = {
  topic: string;
  description?: string;
  pages?: number[];
  subtopics?: Array<{
    subtopic: string;
    description?: string;
    pages?: number[];
  }>;
};

/**
 * Group topics from all sources (simple grouping, no AI)
 * Topics with same name are combined, subtopics merged
 */
export function groupTopicsFromSources(
  sources: ChatContext["sources"]
): TopicNode[] {
  const topicMap = new Map<string, TopicNode>();

  for (const source of sources) {
    for (const topic of source.mainTopics || []) {
      const topicKey = topic.topic.toLowerCase().trim();
      
      if (topicMap.has(topicKey)) {
        // Topic exists - merge subtopics and pages
        const existing = topicMap.get(topicKey)!;
        
        // Merge subtopics
        const existingSubtopicKeys = new Set(
          (existing.subtopics || []).map(st => st.subtopic.toLowerCase())
        );
        
        const newSubtopics = (topic.subtopics || []).filter(
          st => !existingSubtopicKeys.has(st.subtopic.toLowerCase())
        );
        
        existing.subtopics = [
          ...(existing.subtopics || []),
          ...newSubtopics
        ];
        
        // Combine pages
        existing.pages = [
          ...new Set([
            ...(existing.pages || []),
            ...(topic.pages || [])
          ])
        ];
      } else {
        // New topic - add it
        topicMap.set(topicKey, {
          topic: topic.topic,
          description: topic.description,
          pages: topic.pages || [],
          subtopics: topic.subtopics || []
        });
      }
    }
  }

  return Array.from(topicMap.values());
}

/**
 * Combine summaries from all sources (simple concatenation)
 */
export function combineSummaries(sources: ChatContext["sources"]): string {
  return sources
    .map(s => `${s.title}: ${s.summary}`)
    .join("\n\n");
}
```

---

## Step 2: Update Source Upload Functions

### 2.1 Update `app/actions/upload-and-ingest.ts`

**Change:** Remove `mergeSourceIntoContext()` calls, just append sources

**Before:**
```typescript
const mergedContext = await mergeSourceIntoContext({
  existingSummary: existingContext.globalSummary,
  existingTopics: existingContext.globalTopics,
  existingSources: existingContext.sources,
  source: sourceEntry,
  chatId: targetChatId,
  useSemanticMerging: true,
});

await upsertChatContext({
  chatId: targetChatId,
  sources: mergedContext.sources,
  globalSummary: mergedContext.globalSummary,
  globalTopics: mergedContext.globalTopics,
});
```

**After:**
```typescript
// Just append source - no merging
const updatedSources = [
  ...(existingContext?.sources || []),
  sourceEntry
];

await upsertChatContext({
  chatId: targetChatId,
  sources: updatedSources,
  globalSummary: "",  // Not used in Option B
  globalTopics: [],    // Not used in Option B
});
```

### 2.2 Update `app/actions/add-source-to-chat.ts`

**Same change:** Remove merge, just append

---

## Step 3: Update Edit Mode Consolidation

### 3.1 Create `lib/blocknote/interaction-matcher.ts`

**Purpose:** Match messages/flashcards/quizzes to topics

```typescript
import type { ChatMessage } from "@/lib/types";

/**
 * Find AI-generated explanation for a topic
 * Looks for messages that are topic explanations
 */
export function findExplanationForTopic(
  messages: ChatMessage[],
  topicName: string
): string | null {
  // Look for messages that contain topic name and are explanations
  // This is a simple implementation - can be enhanced
  const topicLower = topicName.toLowerCase();
  
  for (const msg of messages) {
    if (msg.role === "assistant") {
      const textParts = msg.parts?.filter(p => p.type === "text") || [];
      for (const part of textParts) {
        const text = part.text?.toLowerCase() || "";
        // Simple check: if message mentions topic and is explanation-like
        if (text.includes(topicLower) && text.length > 100) {
          return part.text || null;
        }
      }
    }
  }
  
  return null;
}

/**
 * Find Q&A pairs related to a topic
 */
export function findQAByTopic(
  messages: ChatMessage[],
  topicName: string
): Array<{ question: string; answer: string }> {
  const topicLower = topicName.toLowerCase();
  const qaPairs: Array<{ question: string; answer: string }> = [];
  
  for (let i = 0; i < messages.length - 1; i++) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];
    
    if (userMsg.role === "user" && assistantMsg.role === "assistant") {
      const questionPart = userMsg.parts?.find(p => p.type === "text");
      const answerPart = assistantMsg.parts?.find(p => p.type === "text");
      
      if (questionPart && answerPart) {
        const question = questionPart.text?.toLowerCase() || "";
        // Simple check: if question mentions topic
        if (question.includes(topicLower)) {
          qaPairs.push({
            question: questionPart.text || "",
            answer: answerPart.text || ""
          });
        }
      }
    }
  }
  
  return qaPairs;
}
```

### 3.2 Update `lib/blocknote/context-to-blocks.ts`

**Change:** Use simple grouping instead of merged topics, include all interactions

```typescript
import { groupTopicsFromSources, combineSummaries } from "./topic-grouping";
import { findExplanationForTopic, findQAByTopic } from "./interaction-matcher";
import type { ChatContext } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import type { PartialBlock } from "@blocknote/core";
import { convertTopicsToBlocks } from "./message-to-blocks";

export function convertMergedContextToBlocks(
  context: ChatContext | null,
  messages: ChatMessage[] = [],
  documentIds?: string[]
): PartialBlock[] {
  const blocks: PartialBlock[] = [];
  
  if (!context) {
    return blocks;
  }
  
  // 1. Knowledge Overview heading
  blocks.push({
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "Knowledge Overview", styles: { bold: true } }],
  });
  
  // 2. Combined summary (simple concatenation, not AI synthesis)
  const combinedSummary = combineSummaries(context.sources);
  if (combinedSummary.trim()) {
    blocks.push({
      type: "summary",
      props: {
        summary: combinedSummary,
        documentIds: documentIds || context.sources.map(s => s.documentId),
        summaryType: "document",
      },
      content: [],
    });
  }
  
  // 3. Group topics from all sources (simple grouping, no AI)
  const unifiedTopics = groupTopicsFromSources(context.sources);
  
  // 4. For each topic, add explanation and Q&A
  for (const topic of unifiedTopics) {
    // Topic heading
    blocks.push({
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: topic.topic, styles: { bold: true } }],
    });
    
    // AI-generated explanation (from Agent Mode)
    const explanation = findExplanationForTopic(messages, topic.topic);
    if (explanation) {
      blocks.push({
        type: "paragraph",
        content: [{ type: "text", text: explanation }],
      });
    }
    
    // Q&A related to this topic
    const topicQA = findQAByTopic(messages, topic.topic);
    for (const qa of topicQA) {
      blocks.push({
        type: "questionAnswer",
        props: {
          question: qa.question,
          answer: qa.answer,
          documentIds: documentIds || context.sources.map(s => s.documentId),
        },
        content: [],
      });
    }
    
    // Subtopics (with their explanations/Q&A)
    if (topic.subtopics && topic.subtopics.length > 0) {
      for (const subtopic of topic.subtopics) {
        blocks.push({
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: subtopic.subtopic }],
        });
        
        const subtopicExplanation = findExplanationForTopic(messages, subtopic.subtopic);
        if (subtopicExplanation) {
          blocks.push({
            type: "paragraph",
            content: [{ type: "text", text: subtopicExplanation }],
          });
        }
        
        const subtopicQA = findQAByTopic(messages, subtopic.subtopic);
        for (const qa of subtopicQA) {
          blocks.push({
            type: "questionAnswer",
            props: {
              question: qa.question,
              answer: qa.answer,
              documentIds: documentIds || context.sources.map(s => s.documentId),
            },
            content: [],
          });
        }
      }
    }
  }
  
  return blocks;
}
```

### 3.3 Update `components/hybrid-notebook-view.tsx`

**Change:** Pass messages to `convertMergedContextToBlocks()`

```typescript
// In initialBlocks useMemo:
const contextBlocks = convertMergedContextToBlocks(
  chatContext,
  messages,  // Pass messages for explanations/Q&A matching
  documentIds
);
```

---

## Step 4: Testing Checklist

- [ ] Add first source → Should be instant (no delay)
- [ ] Add second source → Should be instant (no delay)
- [ ] Ask questions → Should search both sources
- [ ] Expand topic → Should generate explanation
- [ ] Switch to Edit Mode → Should show unified topics with explanations and Q&A
- [ ] Verify no expensive AI calls on source upload

---

## Files to Modify

1. `app/actions/upload-and-ingest.ts` - Remove merge, just append
2. `app/actions/add-source-to-chat.ts` - Remove merge, just append
3. `lib/blocknote/topic-grouping.ts` - NEW: Simple topic grouping
4. `lib/blocknote/interaction-matcher.ts` - NEW: Match interactions to topics
5. `lib/blocknote/context-to-blocks.ts` - Use grouping, include interactions
6. `components/hybrid-notebook-view.tsx` - Pass messages to conversion

---

## Benefits After Implementation

- **Speed:** Instant source addition (no 5-15s delay)
- **Cost:** $0 per source (no AI merging)
- **Data:** Original summaries/topics preserved
- **Edit Mode:** Still shows unified view (just grouped differently)
- **Q&A:** Already works (searches all sources)





