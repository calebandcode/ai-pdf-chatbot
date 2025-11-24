# Edit Mode Consolidation Plan

## Decision Point: Option A vs Option B

### Current Implementation: Option A (Merge & Regenerate)

**What happens now:**

- Every new source triggers `mergeSourceIntoContext()`
- Topics merged semantically (embeddings + AI) - ~$0.10-0.15 per source
- Global summary regenerated (AI synthesis) - ~$0.10-0.15 per source
- Total: ~$0.20-0.30 per source, 5-15 seconds delay
- Result: Unified `globalSummary` + `globalTopics`

**Pros:**

- ✅ Unified view across all sources
- ✅ Coherent narrative (AI synthesizes connections)
- ✅ Edit Mode shows one consolidated notebook

**Cons:**

- ❌ Slower (5-15 seconds per source)
- ❌ More expensive (~$0.20-0.30 per source)
- ❌ Complex merge logic
- ❌ Risk: New source can dilute good summaries

### Alternative: Option B (Contextual Only)

**How it would work:**

- New source added → Stored separately, no merging
- Each source keeps its own summary + topics
- Agent Mode: All sources available as context for Q&A
- Edit Mode: Show all sources separately (or user chooses)

**Pros:**

- ✅ Instant (no AI calls)
- ✅ Free (no additional cost)
- ✅ Preserves originals (no overwriting)
- ✅ User control (toggle sources on/off)

**Cons:**

- ⚠️ Fragmented view (multiple summaries, multiple topic trees)
- ⚠️ No automatic connections
- ⚠️ Edit Mode more complex (multiple sources to organize)

### Recommendation for Study Companion Vision

**For a study companion (students exploring topics):**

- **Option B fits better** - faster, cheaper, preserves user control
- **But:** Current Option A implementation is already built and working

**Hybrid Approach (Best of Both):**

- Keep Option A for unified view (already implemented)
- **Optimize cost/speed:**
  - Make semantic merging optional (user choice)
  - Cache embeddings to reduce costs
  - Show progress indicator during merge
- **Add Option B features:**
  - Allow users to see individual source summaries (toggle view)
  - Preserve original summaries alongside merged ones

---

## Core Problem

**Current Edit Mode:**

```
Knowledge Overview
  - Summary
  - Topics (all topics)
Conversations (Q&A dumped at end - flat list)
```

**Desired Edit Mode:**

```
Knowledge Overview
  - Summary
Topics
  - Topic 1: Robot Control
    - AI Explanation
    - Q&A: "How does adaptive control work?" → Answer
    - Q&A: "Give me examples" → Answer
  - Topic 2: Robot Manipulation
    - AI Explanation
    - Q&A: ...
```

**Key Issue:** Q&A is dumped at the end instead of being organized under relevant topics.

---

## Solution: Organize Q&A by Topic

### Step 1: Match Q&A to Topics

**Function:** `matchQAToTopics(qaMessages: ChatMessage[], topics: TopicNode[])`

**Simple Logic:**

1. Extract question text from each Q&A pair
2. For each topic, check if question keywords match topic name/description
3. If match found, assign Q&A to that topic
4. If no match, assign to "General Q&A" section

**Implementation:**

- Use simple keyword matching (topic name in question, or question keywords in topic description)
- Can enhance later with semantic similarity if needed

### Step 2: Insert Q&A Under Topics

**Update:** `convertMergedContextToBlocks()` or create new function

**Structure:**

1. Add Knowledge Overview heading
2. Add Summary
3. For each topic:
   - Add topic explanation block
   - Add related Q&A blocks (nested under topic)
4. Add "General Q&A" section for unmatched Q&A (if any)

### Step 3: Update HybridNotebookView

**Change:** Pass Q&A messages to `convertMergedContextToBlocks()` and let it organize them

---

## Implementation Files

1. **`lib/blocknote/context-to-blocks.ts`**

   - Update `convertMergedContextToBlocks()` to accept Q&A messages
   - Add `matchQAToTopics()` helper function
   - Insert Q&A blocks after each topic's explanation

2. **`components/hybrid-notebook-view.tsx`**
   - Pass `qaMessages` to `convertMergedContextToBlocks()`
   - Remove the separate "Conversations" section logic

---

## Implementation Priority

### Immediate (Core Fix)

1. **Organize Q&A by topic** - Match Q&A to topics and nest them
2. **No flashcards/quizzes in Edit Mode** (as requested)

### Future Considerations

3. **Optimize Option A** - Make merging optional, cache embeddings, show progress
4. **Add Option B toggle** - Allow users to see individual sources vs unified view

---

## That's It

**Immediate focus:** Organize Q&A under relevant topics instead of dumping at the end.

**Option A vs B decision:** Can be optimized later without changing core architecture.
