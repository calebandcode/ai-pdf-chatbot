# Option B (Contextual Only) - Detailed Walkthrough

## Core Principle

**Sources = Context Pool**

- Each source is stored separately with its own summary and topics
- No merging or regeneration
- Q&A searches all sources directly via vector similarity
- Edit Mode shows all sources (or user chooses which to include)

---

## Step-by-Step: Application Flow

### Step 1: User Starts New Chat

**What happens:**

1. User creates new chat → `chatId` generated
2. `ChatContext` record created (or initialized on first source add)
3. `sources: []` (empty array)
4. `globalSummary: ""` (empty - not used in Option B)
5. `globalTopics: []` (empty - not used in Option B)

**Database State:**

```typescript
chat_contexts {
  chatId: "abc-123",
  sources: [],
  globalSummary: "",  // Not used in Option B
  globalTopics: [],    // Not used in Option B
  sourceCount: 0
}
```

---

### Step 2: User Uploads First Source (PDF: "Introduction to Robotics")

**What happens (Option B):**

1. **PDF Processing:**

   - Extract text, chunk it, embed chunks
   - Generate summary: "This document covers basic robotics concepts..."
   - Extract topics: `[{ topic: "Robot Control", ... }, { topic: "Sensors", ... }]`
   - Store in `documents` table
   - Store chunks in `doc_chunks` table

2. **Add to ChatContext (NO MERGING):**

   ```typescript
   // Just append the source - no AI calls, instant
   sources: [
     {
       documentId: "doc-1",
       title: "Introduction to Robotics",
       summary: "This document covers basic robotics concepts...", // Original, preserved
       mainTopics: [
         { topic: "Robot Control", description: "...", pages: [1, 2] },
         { topic: "Sensors", description: "...", pages: [3, 4] },
       ],
     },
   ];
   ```

3. **Save to Database:**

   ```typescript
   await upsertChatContext({
     chatId: "abc-123",
     sources: [source1], // Just the new source
     globalSummary: "", // Empty (not used)
     globalTopics: [], // Empty (not used)
     sourceCount: 1,
   });
   ```

4. **Display in Agent Mode:**
   - Show PDF upload message with:
     - Document card
     - Summary: "This document covers basic robotics concepts..."
     - Topics: Robot Control, Sensors
   - **No delay** - instant display

**Database State:**

```typescript
chat_contexts {
  chatId: "abc-123",
  sources: [
    {
      documentId: "doc-1",
      title: "Introduction to Robotics",
      summary: "This document covers basic robotics concepts...",
      mainTopics: [
        { topic: "Robot Control", ... },
        { topic: "Sensors", ... }
      ]
    }
  ],
  globalSummary: "",  // Not used
  globalTopics: [],   // Not used
  sourceCount: 1
}
```

**Cost:** $0 (no merging)
**Time:** Instant (no AI synthesis)

---

### Step 3: User Asks Question: "How does robot control work?"

**What happens (Option B):**

1. **Extract document IDs from ChatContext:**

   ```typescript
   const context = await getChatContext({ chatId: "abc-123" });
   const docIds = context.sources.map((s) => s.documentId); // ["doc-1"]
   ```

2. **Search All Sources:**

   ```typescript
   const relevantChunks = await retrieveTopK({
     userId: "user-1",
     docIds: ["doc-1"], // Search in doc-1
     query: "How does robot control work?",
     k: 12,
   });
   ```

3. **Vector Similarity Search:**

   - Embed question: `[0.1, 0.2, ...]`
   - Compare with all chunks in `doc-1`
   - Return top 12 most similar chunks
   - Chunks come from pages 1, 2 (Robot Control section)

4. **Generate Answer:**
   - Use retrieved chunks as context
   - Answer: "Robot control involves..."
   - Citations: Pages 1, 2

**Result:** Answer based on "Introduction to Robotics" only (since it's the only source)

---

### Step 4: User Uploads Second Source (PDF: "Advanced Control Systems")

**What happens (Option B):**

1. **PDF Processing:**

   - Extract text, chunk it, embed chunks
   - Generate summary: "This document covers advanced control systems..."
   - Extract topics: `[{ topic: "Robot Control", ... }, { topic: "Neural Networks", ... }]`
   - Store in `documents` table
   - Store chunks in `doc_chunks` table

2. **Add to ChatContext (NO MERGING - Just Append):**

   ```typescript
   // Just append - no AI calls, instant
   sources: [
     {
       documentId: "doc-1",
       title: "Introduction to Robotics",
       summary: "This document covers basic robotics concepts...",  // Original preserved
       mainTopics: [...]
     },
     {
       documentId: "doc-2",
       title: "Advanced Control Systems",
       summary: "This document covers advanced control systems...",  // Original preserved
       mainTopics: [
         { topic: "Robot Control", ... },  // Same topic name, but separate entry
         { topic: "Neural Networks", ... }
       ]
     }
   ]
   ```

3. **Save to Database:**

   ```typescript
   await upsertChatContext({
     chatId: "abc-123",
     sources: [source1, source2], // Both sources, separate
     globalSummary: "", // Still empty (not used)
     globalTopics: [], // Still empty (not used)
     sourceCount: 2,
   });
   ```

4. **Display in Agent Mode:**
   - Show PDF upload message with:
     - Document card
     - Summary: "This document covers advanced control systems..."
     - Topics: Robot Control, Neural Networks
   - **No delay** - instant display

**Database State:**

```typescript
chat_contexts {
  chatId: "abc-123",
  sources: [
    {
      documentId: "doc-1",
      title: "Introduction to Robotics",
      summary: "This document covers basic robotics concepts...",
      mainTopics: [
        { topic: "Robot Control", description: "Basic control...", pages: [1, 2] },
        { topic: "Sensors", ... }
      ]
    },
    {
      documentId: "doc-2",
      title: "Advanced Control Systems",
      summary: "This document covers advanced control systems...",
      mainTopics: [
        { topic: "Robot Control", description: "Advanced control...", pages: [3, 4] },
        { topic: "Neural Networks", ... }
      ]
    }
  ],
  globalSummary: "",  // Not used
  globalTopics: [],   // Not used
  sourceCount: 2
}
```

**Cost:** $0 (no merging)
**Time:** Instant (no AI synthesis)

**Key Point:** Both sources have "Robot Control" topic, but they're **separate entries** - not merged.

---

### Step 5: User Asks Question: "Explain adaptive control"

**What happens (Option B):**

1. **Extract All Document IDs:**

   ```typescript
   const context = await getChatContext({ chatId: "abc-123" });
   const docIds = context.sources.map((s) => s.documentId);
   // ["doc-1", "doc-2"] - ALL sources
   ```

2. **Search ALL Sources:**

   ```typescript
   const relevantChunks = await retrieveTopK({
     userId: "user-1",
     docIds: ["doc-1", "doc-2"], // Search in BOTH sources
     query: "Explain adaptive control",
     k: 12,
   });
   ```

3. **Vector Similarity Search:**

   - Embed question: `[0.1, 0.2, ...]`
   - Compare with all chunks in **both** `doc-1` and `doc-2`
   - Return top 12 most similar chunks
   - Chunks might come from:
     - `doc-1` page 2 (basic adaptive control)
     - `doc-2` page 4 (advanced adaptive control)

4. **Generate Answer:**
   - Use retrieved chunks from **both sources** as context
   - Answer: "Adaptive control involves... [from doc-1] ... Additionally, advanced systems... [from doc-2]"
   - Citations: Pages 2 (doc-1), Page 4 (doc-2)

**Result:** Answer synthesizes information from **both sources** automatically via vector search.

**Key Point:** Q&A works across all sources **without merging** - vector search handles it.

---

### Step 5.5: User Expands Topics in Agent Mode (AI-Generated Explanations)

**What happens (Agent Mode Learning):**

1. **User clicks "Robot Control" topic to expand:**

   - System calls `explainTopic()` with:
     - Topic: "Robot Control"
     - Pages: [1, 2] (from doc-1) + [3, 4] (from doc-2)
     - DocumentIds: ["doc-1", "doc-2"]

2. **AI Generates Explanation:**

   ```typescript
   // Gets chunks from both sources
   const chunks = await getDocumentChunks({ documentId: "doc-1" });
   const chunks2 = await getDocumentChunks({ documentId: "doc-2" });

   // Generates teaching explanation
   const explanation = await generateText({
     prompt: `Explain Robot Control using content from pages 1,2,3,4...`,
   });
   ```

3. **Explanation Saved as Message:**

   ```typescript
   await saveMessages({
     messages: [
       {
         role: "assistant",
         parts: [{ type: "text", text: explanation }],
         // This explanation is linked to topic "Robot Control"
       },
     ],
   });
   ```

4. **User Asks Follow-up Questions:**

   - "Give me examples"
   - "Explain this in simpler terms"
   - Each Q&A saved as messages

5. **User Generates Flashcards/Quizzes:**
   - Creates flashcards for "Robot Control"
   - Creates quiz for "Robot Control"
   - Stored in database linked to `chatId` and topic

**Key Point:** All these interactions (explanations, Q&A, flashcards, quizzes) are **stored** and will be consolidated in Edit Mode.

---

### Step 6: User Switches to Edit Mode (Knowledge Consolidation)

**What happens (Option B):**

1. **Fetch ChatContext:**

   ```typescript
   const context = await getChatContext({ chatId: "abc-123" });
   // Returns: { sources: [source1, source2], globalSummary: "", globalTopics: [] }
   ```

2. **Collect All Topics from All Sources:**

   ```typescript
   // Simple grouping (no AI merging)
   const allTopics: Map<string, TopicNode> = new Map();

   for (const source of context.sources) {
     for (const topic of source.mainTopics) {
       const topicKey = topic.topic.toLowerCase();

       if (allTopics.has(topicKey)) {
         // Topic exists - merge subtopics (simple merge, no AI)
         const existing = allTopics.get(topicKey)!;
         existing.subtopics = [
           ...(existing.subtopics || []),
           ...(topic.subtopics || []),
         ];
         // Combine pages
         existing.pages = [
           ...new Set([...(existing.pages || []), ...(topic.pages || [])]),
         ];
       } else {
         // New topic - add it
         allTopics.set(topicKey, { ...topic });
       }
     }
   }

   const unifiedTopics = Array.from(allTopics.values());
   ```

3. **Fetch All Agent Interactions:**

   ```typescript
   // Get all messages (explanations, Q&A)
   const allMessages = await getMessages({ chatId: "abc-123" });

   // Get flashcards for this chat
   const flashcards = await getFlashcardsByChat({ chatId: "abc-123" });

   // Get quizzes for this chat
   const quizzes = await getChatQuizzesByChat({ chatId: "abc-123" });
   ```

4. **Convert to Blocks (Consolidate ALL Interactions):**

   ```typescript
   function convertContextToBlocksOptionB(
     context: ChatContext,
     messages: ChatMessage[],
     flashcards: Flashcard[],
     quizzes: ChatQuiz[]
   ): PartialBlock[] {
     const blocks: PartialBlock[] = [];

     // 1. Knowledge Overview heading
     blocks.push({ type: "heading", content: "Knowledge Overview" });

     // 2. Combined summary (simple concatenation, not AI synthesis)
     const combinedSummary = context.sources
       .map((s) => `${s.title}: ${s.summary}`)
       .join("\n\n");

     blocks.push({
       type: "summary",
       props: {
         summary: combinedSummary,
         documentIds: context.sources.map((s) => s.documentId),
         summaryType: "document",
       },
     });

     // 3. Unified topics (grouped from all sources)
     const unifiedTopics = groupTopicsFromSources(context.sources);

     // 4. For each topic, add:
     for (const topic of unifiedTopics) {
       // Topic heading
       blocks.push({ type: "heading", level: 2, content: topic.topic });

       // AI-generated explanation (from Agent Mode)
       const topicExplanation = findExplanationForTopic(messages, topic.topic);
       if (topicExplanation) {
         blocks.push({
           type: "paragraph",
           content: [{ type: "text", text: topicExplanation }],
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
             documentIds: context.sources.map((s) => s.documentId),
           },
         });
       }

       // Subtopics with their explanations/Q&A
       // ...
     }

     // 5. Appendices: Flashcards and Quizzes
     if (flashcards.length > 0 || quizzes.length > 0) {
       blocks.push({ type: "heading", level: 1, content: "Appendices" });

       // Flashcards organized by topic
       // Quizzes organized by topic
     }

     return blocks;
   }
   ```

5. **Display Structure (Consolidated from ALL Interactions):**

   ```
   📓 Study Notebook

   ## Knowledge Overview
   [Combined summary from all sources]

   ## Topics

   ### Robot Control
   [AI-generated explanation from Agent Mode - when user expanded this topic]

   Q&A:
   - "How does adaptive control work?" → [Answer from Agent Mode]
   - "Give me examples" → [Answer from Agent Mode]

   - Subtopic: Basic Control
     [AI explanation]
     Q&A: "What's the difference between..." → [Answer]

   - Subtopic: Advanced Control
     [AI explanation]
     Q&A: "How do neural networks help?" → [Answer]

   ### Sensors
   [AI-generated explanation from Agent Mode]
   Q&A: [Related Q&A]

   ### Neural Networks
   [AI-generated explanation from Agent Mode]
   Q&A: [Related Q&A]

   ## Appendices

   ### Flashcards
   [Flashcards organized by topic - from Agent Mode interactions]

   ### Quizzes
   [Quizzes organized by topic - from Agent Mode interactions]
   ```

**Key Point:** Edit Mode consolidates **everything**:

- Source content (summaries, topics)
- **AI-generated explanations** (from Agent Mode topic expansions)
- **Q&A** (from Agent Mode conversations)
- **Flashcards/quizzes** (from Agent Mode interactions)
- All organized by **topic**, not by source

---

## Schema Changes for Option B

### Current Schema (Option A):

```typescript
chat_contexts {
  chatId: uuid
  sources: Array<{
    documentId: string
    title: string
    summary: string
    mainTopics: TopicNode[]
  }>
  globalSummary: string      // Merged summary (Option A)
  globalTopics: TopicNode[]  // Merged topics (Option A)
}
```

### Option B Schema (Simplified):

```typescript
chat_contexts {
  chatId: uuid
  sources: Array<{
    documentId: string
    title: string
    summary: string           // Individual summary (preserved)
    mainTopics: TopicNode[]   // Individual topics (preserved)
    isActive?: boolean        // Optional: toggle on/off
  }>
  // Remove or make optional:
  globalSummary?: string      // Not used (or optional for manual merge)
  globalTopics?: TopicNode[]  // Not used (or optional for manual merge)
}
```

**Or keep schema same, just don't populate `globalSummary`/`globalTopics`**

---

## Code Changes Required

### 1. Update `upload-and-ingest.ts`

**Current (Option A):**

```typescript
// Expensive merging
const mergedContext = await mergeSourceIntoContext({
  existingSummary: existingContext.globalSummary,
  existingTopics: existingContext.globalTopics,
  existingSources: existingContext.sources,
  source: sourceEntry,
  chatId: targetChatId,
  useSemanticMerging: true, // Expensive!
});

await upsertChatContext({
  chatId: targetChatId,
  sources: mergedContext.sources,
  globalSummary: mergedContext.globalSummary, // Generated
  globalTopics: mergedContext.globalTopics, // Generated
});
```

**Option B:**

```typescript
// Just append - no merging
const updatedSources = [
  ...(existingContext?.sources || []),
  sourceEntry, // Just add the new source
];

await upsertChatContext({
  chatId: targetChatId,
  sources: updatedSources, // Just append
  globalSummary: "", // Empty (not used)
  globalTopics: [], // Empty (not used)
});
```

**Time saved:** 5-15 seconds per source
**Cost saved:** ~$0.20-0.30 per source

---

### 2. Update `convertMergedContextToBlocks()` for Edit Mode

**Current (Option A):**

```typescript
// Uses globalSummary and globalTopics (merged)
if (context.globalSummary) {
  blocks.push({ type: "summary", props: { summary: context.globalSummary } });
}
if (context.globalTopics) {
  blocks.push(...convertTopicsToBlocks(context.globalTopics));
}
```

**Option B:**

```typescript
// Group topics from all sources (simple grouping, no AI)
const unifiedTopics = groupTopicsFromSources(context.sources);

// Show unified view organized by topic
blocks.push({ type: "heading", content: "Knowledge Overview" });
blocks.push({
  type: "summary",
  props: {
    summary: combineSummaries(context.sources), // Simple concatenation
    documentIds: context.sources.map((s) => s.documentId),
  },
});
blocks.push(...convertTopicsToBlocks(unifiedTopics)); // Unified topics
```

---

### 3. Q&A Already Works (No Changes Needed)

**Current implementation already searches all sources:**

```typescript
// In app/(chat)/api/chat/route.ts
const docIds = derivedDocumentIds; // All document IDs from chat
const relevantChunks = await retrieveTopK({
  docIds: docIds, // Searches ALL sources
  query: userMessageText,
  k: 12,
});
```

**This already works for Option B!** No changes needed.

---

## Benefits Summary

### Speed

- **Option A:** 5-15 seconds per source (AI merging)
- **Option B:** Instant (just append to array)

### Cost

- **Option A:** ~$0.20-0.30 per source
- **Option B:** $0 per source

### Data Preservation

- **Option A:** Original summaries/topics overwritten
- **Option B:** Original summaries/topics preserved

### Edit Mode Display

- **Option A:** Unified view (AI-merged topics/summary)
- **Option B:** Unified view (simple grouped topics/summary) - **same result, different method**

### Q&A Quality

- **Option A:** Same (searches all sources via vector similarity)
- **Option B:** Same (searches all sources via vector similarity)

**Q&A works the same in both options** - vector search handles multi-source queries automatically.

---

## When to Use Each

### Option A (Merge & Regenerate) - Best For:

- Research notebooks (academic papers, reports)
- When sources are closely related
- When unified narrative is critical
- When cost/speed don't matter

### Option B (Contextual Only) - Best For:

- Study notebooks (students exploring topics) ✅ **Your use case**
- When sources are supplementary
- When speed/cost matter
- When comparing perspectives is valuable
- When preserving originals is important

---

## Implementation Checklist

- [ ] Remove `mergeSourceIntoContext()` call from `upload-and-ingest.ts`
- [ ] Change to simple append: `sources: [...existing, newSource]`
- [ ] Set `globalSummary: ""` and `globalTopics: []` (or make optional)
- [ ] Update `convertMergedContextToBlocks()` to show sources separately
- [ ] Update Edit Mode to display each source with its original summary/topics
- [ ] (Optional) Add source toggle UI in Agent Mode
- [ ] (Optional) Add manual merge button in Edit Mode (if user wants unified view)

**Q&A requires no changes** - it already searches all sources.
