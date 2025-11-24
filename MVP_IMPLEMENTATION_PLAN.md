# 🎯 MVP Implementation Plan

## ✅ Plan Review & Validation

Your MVP plan is **excellent** and well-prioritized. Here's my assessment:

### Strengths:
- ✅ Focused on core student pain points
- ✅ Avoids feature bloat
- ✅ Realistic complexity estimates
- ✅ Clear MVP vs. post-MVP separation
- ✅ Cost-conscious (minimal LLM calls)

### Minor Adjustments Recommended:
1. **Flashcards**: Current schema ties to `lessons` - needs refactor to work with `chatId`/`savedBlocks`
2. **Difficulty Toggle**: Should be stored per-chat (not global) for MVP
3. **Progress Tracker**: Can be computed from existing data (no new tables needed)

---

## 🏗️ Technical Architecture

### **1. Difficulty Toggle**

**Storage:**
- Add `difficultyLevel` field to `Chat` table
- Options: `"age12" | "age15" | "university"`
- Default: `"university"`

**Implementation:**
- UI: Dropdown/segmented control in chat header
- API: Pass `difficultyLevel` in system prompt modifier
- Cost: $0 (just prompt engineering)

**Files to Modify:**
- `lib/db/schema.ts` - Add `difficultyLevel` to `chat` table
- `components/chat.tsx` - Add difficulty selector UI
- `app/(chat)/api/chat/route.ts` - Modify system prompt based on difficulty
- `lib/prompts.ts` (if exists) - Add difficulty modifiers

---

### **2. Highlight → "Explain This Part"**

**Implementation:**
- Use browser `Selection` API to capture highlighted text
- Open contextual chat modal (already exists!) with selected text
- Send to `/api/contextual-chat` with context from current message

**Files to Modify:**
- `components/messages.tsx` - Add text selection handler
- `components/contextual-chat-modal.tsx` - Enhance for highlight context
- `app/api/contextual-chat/route.ts` - Handle highlight queries

**UX Flow:**
1. User highlights text in assistant message
2. Tooltip appears: "Explain this part"
3. Click opens modal with pre-filled context
4. AI explains just that selection

---

### **3. Save-to-Notebook Only**

**Status:** ✅ Already implemented!

**Enhancement Needed:**
- Better extraction of Q&A pairs from messages
- Auto-detect `blockType` (explanation, qa, definition)

**Files to Modify:**
- `app/actions/save-block.ts` - Improve content extraction
- `components/message-actions.tsx` - Already has save button

---

### **4. Auto-Structured Notes in Edit Mode**

**Current State:**
- `saved_blocks` table has `topicName` and `subtopicName` ✅
- Need to group and organize them

**Implementation:**
- Query `saved_blocks` grouped by `topicName` → `subtopicName`
- Generate optional AI summaries for topics/subtopics
- Render as hierarchical structure in BlockNote

**Structure:**
```
# Document Title
## Summary (from chatContext)

## Topic 1
### Subtopic 1.1
- [Saved block 1]
- [Saved block 2]
[Optional: AI-generated topic summary]

### Subtopic 1.2
- [Saved block 3]

## Topic 2
- [Saved block 4]
```

**Files to Modify:**
- `lib/blocknote/context-to-blocks.ts` - Add `organizeSavedBlocksByTopic()` function
- `components/hybrid-notebook-view.tsx` - Use organized structure
- `app/actions/save-block.ts` - Add optional topic/subtopic extraction when saving

**AI Summary Generation:**
- Optional toggle in Edit Mode: "Generate topic summaries"
- Single LLM call per topic (cheap)
- Cache summaries in `saved_blocks.metadata`

---

### **5. Flashcards + Spaced Repetition (SM-2)**

**Current Problem:**
- Flashcards tied to `lessons` table (old schema)
- Need to refactor to work with chats/saved blocks

**New Schema:**
```typescript
export const chatFlashcards = pgTable("chat_flashcards", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  chatId: uuid("chat_id").notNull().references(() => chat.id, { onDelete: "cascade" }),
  savedBlockId: uuid("saved_block_id").references(() => savedBlocks.id, { onDelete: "set null" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  // SM-2 Algorithm fields
  easeFactor: real("ease_factor").notNull().default(2.5), // EF starts at 2.5
  interval: integer("interval").notNull().default(1), // Days until next review
  repetitions: integer("repetitions").notNull().default(0), // Number of successful reviews
  nextReviewDate: timestamp("next_review_date", { withTimezone: true }).notNull(),
  lastReviewDate: timestamp("last_review_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**SM-2 Algorithm Implementation:**
```typescript
// lib/spaced-repetition/sm2.ts
export function calculateNextReview(
  quality: 0 | 1 | 2 | 3 | 4 | 5, // User's rating
  easeFactor: number,
  interval: number,
  repetitions: number
): {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
} {
  // SM-2 algorithm logic
  // Returns updated card state
}
```

**UI Components:**
- Flashcard creation: Button in `message-actions.tsx` → "Create Flashcard"
- Flashcard review: New component `components/flashcard-review.tsx`
- Review queue: "Due today" section in Edit Mode sidebar

**Files to Create:**
- `lib/spaced-repetition/sm2.ts` - SM-2 algorithm
- `lib/db/queries.ts` - Add flashcard CRUD functions
- `components/flashcard-review.tsx` - Review interface
- `app/actions/create-flashcard.ts` - Server action

**Files to Modify:**
- `lib/db/schema.ts` - Add `chat_flashcards` table
- `components/message-actions.tsx` - Add "Create Flashcard" button
- `components/hybrid-notebook-view.tsx` - Show review queue

---

### **6. Simple Progress Tracker**

**Implementation:**
- Compute from existing data (no new tables!)
- Track: topics viewed, notes saved, flashcards created/mastered

**Metrics:**
```typescript
type ProgressMetrics = {
  topicsExplored: number; // From chatContext.sources[].mainTopics
  notesSaved: number; // Count saved_blocks for chatId
  flashcardsCreated: number; // Count chat_flashcards for chatId
  flashcardsMastered: number; // Count where interval > 30 days
  lastStudied: Date | null; // Max lastReviewDate from flashcards
};
```

**Display:**
- Inline in Edit Mode header
- Simple stats bar or numbers
- No gamification (keep it clean)

**Files to Create:**
- `lib/progress/calculate-progress.ts` - Compute metrics
- `components/progress-stats.tsx` - Display component

**Files to Modify:**
- `components/hybrid-notebook-view.tsx` - Add progress display

---

## 📋 Implementation Order

### **Week 1: Core Enhancements**

#### Day 1-2: Difficulty Toggle
1. Add `difficultyLevel` to `chat` schema
2. Create migration
3. Add UI selector in chat header
4. Modify system prompt in chat API
5. Test with different difficulty levels

#### Day 3-4: Highlight → Explain
1. Add text selection handler to messages
2. Enhance contextual chat modal for highlights
3. Update API to handle highlight context
4. Test selection flow

#### Day 5: Save-to-Notebook Polish
1. Improve content extraction in `save-block.ts`
2. Auto-detect block types
3. Better topic/subtopic extraction

---

### **Week 2: Structure & Memory**

#### Day 1-3: Auto-Structured Notes
1. Create `organizeSavedBlocksByTopic()` function
2. Update `convertSavedBlocksToBlocks()` to use organization
3. Add optional AI summary generation
4. Test with various topic structures

#### Day 4-5: Flashcards Schema & Creation
1. Create `chat_flashcards` table migration
2. Implement SM-2 algorithm
3. Add "Create Flashcard" button
4. Build flashcard creation UI
5. Test creation flow

---

### **Week 3: Spaced Repetition & Progress**

#### Day 1-3: Spaced Repetition Review System
1. Build flashcard review component
2. Implement review queue ("Due today")
3. Add review rating UI (0-5 scale)
4. Update cards after review using SM-2
5. Test review flow

#### Day 4-5: Progress Tracker
1. Create progress calculation function
2. Build progress stats component
3. Integrate into Edit Mode
4. Test metrics accuracy

---

## 🗄️ Database Migrations Needed

### Migration 1: Add Difficulty Level
```sql
ALTER TABLE "Chat" ADD COLUMN "difficulty_level" varchar(20) DEFAULT 'university';
```

### Migration 2: Chat Flashcards
```sql
CREATE TABLE "chat_flashcards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chat_id" uuid NOT NULL,
  "saved_block_id" uuid,
  "front" text NOT NULL,
  "back" text NOT NULL,
  "ease_factor" real DEFAULT 2.5 NOT NULL,
  "interval" integer DEFAULT 1 NOT NULL,
  "repetitions" integer DEFAULT 0 NOT NULL,
  "next_review_date" timestamp with time zone NOT NULL,
  "last_review_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_flashcards_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE cascade,
  CONSTRAINT "chat_flashcards_saved_block_id_fk" FOREIGN KEY ("saved_block_id") REFERENCES "saved_blocks"("id") ON DELETE set null
);

CREATE INDEX "chat_flashcards_chat_id_idx" ON "chat_flashcards" ("chat_id");
CREATE INDEX "chat_flashcards_next_review_date_idx" ON "chat_flashcards" ("next_review_date");
```

---

## 📁 File Structure

```
lib/
  spaced-repetition/
    sm2.ts              # SM-2 algorithm
    types.ts            # Flashcard types
  progress/
    calculate-progress.ts
    types.ts
  prompts/
    difficulty-modifiers.ts  # Prompt modifiers for difficulty levels

components/
  flashcard-review.tsx       # Review interface
  progress-stats.tsx         # Progress display
  difficulty-selector.tsx    # Difficulty toggle UI

app/actions/
  create-flashcard.ts       # Create flashcard action
  review-flashcard.ts       # Review flashcard action
  generate-topic-summary.ts  # Optional AI summary generation
```

---

## 🎨 UI/UX Considerations

### Difficulty Toggle
- Place in chat header (top right)
- Segmented control: [12] [15] [University]
- Tooltip: "Adjust explanation difficulty"

### Highlight → Explain
- Show tooltip on text selection: "Explain this part"
- Modal opens with selected text highlighted
- Pre-filled prompt: "Explain this part in detail: [selected text]"

### Flashcard Creation
- Button in message actions: "Create Flashcard"
- Modal with front/back fields
- Auto-suggest from message content

### Progress Stats
- Inline in Edit Mode header
- Format: "12 topics • 45 notes • 23 flashcards (8 mastered)"
- Minimal, non-distracting

---

## 🧪 Testing Checklist

### Difficulty Toggle
- [ ] Can change difficulty per chat
- [ ] System prompt reflects difficulty
- [ ] Explanations match difficulty level
- [ ] Persists across page reloads

### Highlight → Explain
- [ ] Can select text in messages
- [ ] Tooltip appears on selection
- [ ] Modal opens with context
- [ ] Explanation is relevant to selection

### Auto-Structured Notes
- [ ] Saved blocks grouped by topic/subtopic
- [ ] Hierarchical structure renders correctly
- [ ] Optional summaries generate correctly
- [ ] Empty topics don't show

### Flashcards
- [ ] Can create flashcard from message
- [ ] SM-2 algorithm calculates correctly
- [ ] Review queue shows due cards
- [ ] Review updates card state
- [ ] Mastered cards don't appear in queue

### Progress Tracker
- [ ] Metrics calculate correctly
- [ ] Updates when content changes
- [ ] Displays in Edit Mode

---

## 💰 Cost Estimates

### Difficulty Toggle
- **Cost:** $0 (prompt modification only)

### Highlight → Explain
- **Cost:** ~$0.01-0.02 per explanation (small LLM call)

### Auto-Structured Notes
- **Cost:** $0 (just grouping) + optional $0.01 per topic summary

### Flashcards
- **Cost:** $0 (algorithm-based, no LLM)

### Progress Tracker
- **Cost:** $0 (computed from existing data)

**Total MVP Cost Impact:** ~$0.02-0.05 per active session (very low!)

---

## 🚀 Post-MVP Enhancements (Future)

1. **Step-by-Step Tutor**: Custom prompt system + progress tracking
2. **Enhanced Formatting**: Better typography, boxes, indentation
3. **Visual Explainers**: Image generation API integration
4. **Voice Narration**: TTS API integration
5. **Group Features**: Shared notebooks, challenges
6. **Research Mode**: Multi-source synthesis, citations

---

## ✅ Success Criteria

MVP is successful when:
1. ✅ Students can adjust explanation difficulty
2. ✅ Students can get instant clarification on highlights
3. ✅ Flashcards follow spaced repetition
4. ✅ Edit Mode shows clean, organized notes
5. ✅ Students can see basic progress
6. ✅ All features work without breaking existing functionality

---

## 📝 Notes

- Keep existing `lessons`/`flashcards` schema for backward compatibility
- New `chat_flashcards` is separate system
- All features should degrade gracefully if APIs fail
- Use optimistic UI updates where possible
- Cache expensive computations (topic summaries)

---

**Ready to start implementation?** Let me know which feature you'd like to tackle first!



