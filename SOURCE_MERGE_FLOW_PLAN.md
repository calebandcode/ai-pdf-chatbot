# Source Merge Flow - Design Plan

## 🎯 Goal
Transform the source adding flow from **"re-analysis"** to **"intelligent merge"**, creating a unified knowledge base that extends rather than restarts.

---

## 🔍 Current Architecture Problems

### Problem 1: Full Re-Analysis on Every Add
**Current Behavior**:
- `generateDocumentSummary()` runs for EVERY new source
- Creates a completely new "AI Tutor Analysis Complete" block
- Generates new topics/subtopics independently
- No awareness of existing context

**Impact**:
- Each document becomes an isolated "island"
- No connection between sources
- Duplicate summaries and redundant analysis
- Poor UX - feels like starting over

### Problem 2: Context Merging is Superficial
**Current Behavior**:
- `mergeSourceIntoContext()` only does basic string concatenation
- Merges summaries by appending text
- Merges topics by name matching only
- No semantic understanding of relationships

**Impact**:
- Lost context about what's new vs. what's existing
- No intelligent topic merging
- Can't identify complementary or contradictory information
- Generic delta messages

### Problem 3: Message Structure Doesn't Reflect Merged State
**Current Behavior**:
- New sources create separate message blocks
- Each source has its own "AI Tutor Analysis Complete"
- No unified view of the knowledge base
- Sources panel shows sources but not relationships

**Impact**:
- Fragmented user experience
- Hard to see the "big picture"
- No clear indication of how sources relate

---

## ✅ Desired Architecture (NotebookLM-Style)

### Core Principles
1. **Unified Knowledge Base**: One global context object per chat
2. **Incremental Merging**: New sources extend, don't replace
3. **Semantic Awareness**: Understand relationships between sources
4. **Conversational Updates**: Natural language explanations of what's new
5. **Single Source of Truth**: One summary, one topic tree, multiple sources

---

## 🏗️ Architecture Design

### 1. Context State Structure

```typescript
type ChatKnowledgeBase = {
  chatId: string;
  sources: Array<{
    documentId: string;
    title: string;
    summary: string;           // Individual source summary
    mainTopics: Topic[];        // Individual source topics
    addedAt: Date;
    metadata: {
      contentType: 'pdf' | 'link' | 'text' | 'youtube';
      pageCount?: number;
      readingTime?: number;
    };
  }>;
  globalSummary: string;        // Merged understanding across ALL sources
  globalTopics: Topic[];        // Unified topic tree (merged from all sources)
  relationships: Array<{
    sourceId1: string;
    sourceId2: string;
    type: 'complementary' | 'contradictory' | 'expands' | 'repeats';
    description: string;
  }>;
  updatedAt: Date;
};
```

### 2. Two-Stage Analysis Pipeline

#### Stage 1: Individual Source Analysis (Lightweight)
**Purpose**: Extract basic information from the new source
**When**: Immediately when source is added
**Output**: Individual summary, topics, metadata

**Function**: `analyzeSourceIndividually()`
- Extract summary (concise, focused on THIS source)
- Extract topics/subtopics
- Extract metadata (pages, reading time, etc.)
- **DO NOT** compare with existing sources
- **DO NOT** generate global summary

#### Stage 2: Contextual Merge Analysis (Intelligent)
**Purpose**: Understand how new source relates to existing knowledge
**When**: After individual analysis, before saving
**Input**: 
- New source summary + topics
- Existing global summary + topics
- Existing source summaries

**Function**: `mergeSourceIntoKnowledgeBase()`
- Compare new source with existing sources
- Identify:
  - New topics not covered before
  - Existing topics that are expanded/enriched
  - Complementary information
  - Contradictions or different perspectives
  - Redundant information
- Generate:
  - Updated global summary (extends, doesn't replace)
  - Merged topic tree (unified, deduplicated)
  - Relationship descriptions
  - Conversational delta message

---

## 🔄 New Flow Design

### Flow 1: Adding First Source (New Chat)

```
1. User uploads PDF/link/text
   ↓
2. Individual Analysis
   - Extract summary, topics, metadata
   - Store in temporary object
   ↓
3. Create Knowledge Base
   - This is the first source
   - globalSummary = source.summary
   - globalTopics = source.mainTopics
   - sources = [source]
   ↓
4. Create Message
   - Show "AI Tutor Analysis Complete"
   - Display document card with topics
   - Show summary
   ↓
5. Save to Database
   - Save to chat_contexts table
   - Save message with PDFUploadMessage part
```

### Flow 2: Adding Additional Source (Existing Chat)

```
1. User adds new source (PDF/link/text)
   ↓
2. Individual Analysis (Stage 1)
   - Extract summary, topics, metadata
   - Store in temporary object
   ↓
3. Load Existing Knowledge Base
   - Fetch from chat_contexts table
   - Get existing sources, globalSummary, globalTopics
   ↓
4. Contextual Merge Analysis (Stage 2)
   - Compare new source with existing sources
   - Identify new topics, expansions, relationships
   - Generate updated global summary
   - Merge topic trees intelligently
   - Create conversational delta message
   ↓
5. Update Knowledge Base
   - Add new source to sources array
   - Update globalSummary (merged)
   - Update globalTopics (unified tree)
   - Add relationships
   ↓
6. Create Message
   - Text message: Conversational delta (what's new)
   - PDFUploadMessage part: Document card for NEW source only
   - Update existing sources panel
   ↓
7. Save to Database
   - Update chat_contexts table
   - Save new message
   - Keep existing messages intact
```

---

## 🧠 Intelligent Merge Strategies

### 1. Topic Merging Strategy

**Current**: Simple name matching (case-insensitive)
```typescript
// Current: Only matches exact topic names
if (existingTopic.topic.toLowerCase() === newTopic.topic.toLowerCase()) {
  mergeTopics();
}
```

**Proposed**: Semantic + Name Matching
```typescript
// Proposed: Multi-level matching
1. Exact name match (case-insensitive)
2. Semantic similarity (embedding-based)
3. Description overlap analysis
4. Subtopic comparison

// Merge decision tree:
if (exactMatch) {
  mergeTopics(); // Combine pages, merge subtopics
} else if (semanticSimilarity > 0.85) {
  mergeTopics(); // Similar concepts, merge
} else if (descriptionOverlap > 0.7) {
  mergeTopics(); // Related topics, merge
} else {
  addAsNewTopic(); // New topic, add separately
}
```

### 2. Summary Merging Strategy

**Current**: Simple concatenation
```typescript
// Current: Just appends
globalSummary = existingSummary + "\n\nNew insight: " + newSummary;
```

**Proposed**: Intelligent Merging
```typescript
// Proposed: AI-powered merge
1. Identify what's NEW in the new source
2. Identify what EXPANDS existing knowledge
3. Identify what's REDUNDANT
4. Identify CONTRADICTIONS
5. Generate concise merged summary

// Example prompt:
"You have these existing sources: [existing summaries]
A new source was added: [new summary]

Generate a unified summary that:
- Preserves key insights from existing sources
- Highlights what's NEW from the new source
- Shows how sources complement each other
- Is concise and comprehensive
- Sounds natural and conversational"
```

### 3. Delta Message Generation

**Current**: Generic message
```typescript
// Current: Static template
deltaMessage = `Added "${source.title}" to your notebook.`;
```

**Proposed**: Contextual, Informative
```typescript
// Proposed: AI-generated, contextual
deltaMessage = generateContextualDelta({
  newSource: source,
  existingSources: sources,
  newTopics: identifiedNewTopics,
  expandedTopics: identifiedExpandedTopics,
  relationships: identifiedRelationships,
});

// Example outputs:
// "Added 'Bash Scripting Fundamentals' to your notebook. It expands on 
//  conditional logic with practical examples and introduces loop constructs 
//  that weren't covered in your previous sources."

// "Added 'Advanced Python Patterns' to your notebook. It complements your 
//  existing Python basics by covering design patterns and advanced concepts."

// "Added 'JavaScript Guide' to your notebook. This is a new topic area that 
//  adds web development concepts to your programming knowledge base."
```

---

## 🎨 UI/UX Changes

### 1. Single Knowledge Overview
**Current**: Multiple "AI Tutor Analysis Complete" blocks
**Proposed**: One unified knowledge overview at the top

```
┌─────────────────────────────────────────┐
│ Knowledge Overview                      │
│                                         │
│ [Global Summary - merged from all]     │
│                                         │
│ Topics:                                 │
│ • Topic 1 (from Source A, Source B)    │
│ • Topic 2 (from Source A)              │
│ • Topic 3 (from Source C)              │
└─────────────────────────────────────────┘
```

### 2. Sources Panel Enhancement
**Current**: Simple list of sources
**Proposed**: Rich source cards with relationships

```
┌─────────────────────────────────────────┐
│ Sources                                 │
│                                         │
│ 📄 Source A                             │
│    └─ Expands: Topic 1, Topic 2        │
│                                         │
│ 📄 Source B                             │
│    └─ New: Topic 3                     │
│    └─ Complements: Source A            │
└─────────────────────────────────────────┘
```

### 3. Message Structure
**Current**: Separate blocks for each source
**Proposed**: Unified messages with contextual updates

```
Message 1 (First Source):
┌─────────────────────────────────────────┐
│ Done • analyzed 10 pages                │
│                                         │
│ [Document Card: Source A]               │
│ - Summary                               │
│ - Topics                                │
└─────────────────────────────────────────┘

Message 2 (Second Source):
┌─────────────────────────────────────────┐
│ Added 'Source B' to your notebook.      │
│ It expands on Topic 1 with practical    │
│ examples and introduces Topic 3.        │
│                                         │
│ [Document Card: Source B]               │
│ - Summary                               │
│ - Topics                                │
└─────────────────────────────────────────┘
```

---

## 🔧 Implementation Plan

### Phase 1: Refactor Context Structure
**Goal**: Update database schema and types to support unified knowledge base

**Tasks**:
1. Update `chat_contexts` table schema
   - Add `relationships` field (JSONB)
   - Add `updatedAt` timestamp
   - Keep existing fields for backward compatibility

2. Update TypeScript types
   - Create `ChatKnowledgeBase` type
   - Update `ChatContext` type
   - Update `ChatContextSource` type

3. Update database queries
   - Modify `upsertChatContext()` to handle new structure
   - Add relationship tracking
   - Add update timestamp

**Files to Modify**:
- `lib/db/schema.ts`
- `lib/db/queries.ts`
- `lib/ai/context-merge.ts`

### Phase 2: Implement Two-Stage Analysis
**Goal**: Separate individual analysis from contextual merge

**Tasks**:
1. Create `analyzeSourceIndividually()` function
   - Lightweight analysis
   - Extract summary, topics, metadata
   - No context comparison

2. Create `mergeSourceIntoKnowledgeBase()` function
   - Load existing knowledge base
   - Compare new source with existing
   - Generate merged summary
   - Merge topic trees
   - Identify relationships
   - Generate delta message

3. Update `generateDocumentSummary()` 
   - Make it context-aware (optional parameter)
   - If context provided, do merge analysis
   - If no context, do individual analysis

**Files to Modify**:
- `lib/ai/pdf-tutor.ts`
- `lib/ai/context-merge.ts`
- `app/actions/add-source-to-chat.ts`
- `app/actions/upload-and-ingest.ts`

### Phase 3: Implement Intelligent Merging
**Goal**: Smart topic and summary merging

**Tasks**:
1. Topic Merging
   - Implement semantic similarity matching
   - Implement description overlap analysis
   - Implement subtopic merging
   - Handle page number merging

2. Summary Merging
   - Implement AI-powered merge
   - Identify new vs. existing content
   - Handle contradictions
   - Generate concise merged summary

3. Relationship Detection
   - Identify complementary sources
   - Identify contradictory information
   - Identify expansions
   - Identify redundancy

**Files to Modify**:
- `lib/ai/context-merge.ts`
- `lib/ai/pdf-tutor.ts` (new merge functions)

### Phase 4: Update Message Structure
**Goal**: Unified message structure with contextual updates

**Tasks**:
1. Update `addSourceToChat()`
   - Always create PDFUploadMessage part
   - Include contextual delta message
   - Update existing sources panel

2. Update `uploadAndIngest()`
   - Always create PDFUploadMessage part
   - Include contextual delta message
   - Handle both new and existing chats

3. Update message rendering
   - Show unified knowledge overview
   - Show contextual updates
   - Show source relationships

**Files to Modify**:
- `app/actions/add-source-to-chat.ts`
- `app/actions/upload-and-ingest.ts`
- `components/messages/pdf-upload-message.tsx`
- `components/chat.tsx`

### Phase 5: UI/UX Improvements
**Goal**: Better user experience with unified knowledge base

**Tasks**:
1. Knowledge Overview Component
   - Show global summary
   - Show unified topic tree
   - Show source indicators

2. Sources Panel Enhancement
   - Show relationships
   - Show what each source adds
   - Show topic coverage

3. Message Updates
   - Show contextual delta messages
   - Show source relationships
   - Update existing messages

**Files to Modify**:
- `components/knowledge-overview.tsx`
- `components/source-panel.tsx`
- `components/messages/pdf-upload-message.tsx`
- `components/chat.tsx`

---

## 🧪 Testing Strategy

### Unit Tests
1. Individual source analysis
2. Topic merging logic
3. Summary merging logic
4. Relationship detection
5. Delta message generation

### Integration Tests
1. Adding first source (new chat)
2. Adding second source (existing chat)
3. Adding multiple sources
4. Updating existing source
5. Removing source (future)

### E2E Tests
1. Complete flow: Add PDF → Add Link → Add Text
2. Verify knowledge base updates
3. Verify message structure
4. Verify UI updates
5. Verify sources panel

---

## 📊 Success Metrics

### Technical Metrics
- Reduction in duplicate summaries
- Reduction in redundant topic generation
- Improvement in topic merging accuracy
- Reduction in context size (through intelligent merging)

### UX Metrics
- User satisfaction with unified knowledge base
- Time to understand source relationships
- Clarity of delta messages
- Ease of navigating multiple sources

---

## 🚀 Migration Strategy

### Backward Compatibility
1. Keep existing `chat_contexts` structure
2. Add new fields as optional
3. Migrate existing chats gradually
4. Fallback to old behavior if new fields missing

### Rollout Plan
1. Phase 1: Database schema update (non-breaking)
2. Phase 2: Two-stage analysis (feature flag)
3. Phase 3: Intelligent merging (feature flag)
4. Phase 4: UI updates (gradual rollout)
5. Phase 5: Full rollout

---

## 📝 Implementation Decisions (RESOLVED)

### 1. Topic Merging Threshold ✅
**Decision**: Hierarchical merging with cosine similarity
- **≥0.85**: Merge as "same topic (expand existing)"
- **0.6-0.85**: "Related topic (subtopic or complementary)"
- **<0.6**: Treat as new/unique topic
- **Comparison Level**: Topic title + short description (not full text)
- **Embedding Model**: `text-embedding-3-small` (OpenAI) or `MiniLM`
- **Optimization**: Cache embeddings for existing topics, only embed new topics

### 2. Summary Length ✅
**Decision**: 1500-2000 characters (~250-300 words)
- **Strategy**: Delta summaries (changelog-style) for new sources
- **Regeneration**: Every 5 sources OR on user request
- **Format**: Append delta, don't rewrite entire summary each time
- **Example**: "New insights from Source 3: introduced loops and argument handling in bash scripting."

### 3. Relationship Types ✅
**Decision**: Four core relationship types

| Type | Meaning | Example |
|------|---------|---------|
| **complementary** | Adds or deepens understanding | One doc defines loops, another explains performance optimization |
| **expands** | Builds upon or generalizes | Adds real-world examples or advanced use |
| **contradictory** | Conflicts or differs in claims | One says "loops are slower," another says "optimized loops outperform" |
| **repeats** | Duplicates or paraphrases | Common between summaries or overlapping materials |

### 4. Conflict Resolution ✅
**Decision**: Annotate, don't overwrite
- **Strategy**: Keep both perspectives, annotate differences
- **Example**: "Source A states X, while Source B notes Y — these may differ by version."
- **Storage**: Tag as `"status": "conflict"` in topic graph for later resolution

### 5. Performance ✅
**Decision**: Vector DB with batched embeddings
- **Storage**: Vector DB (FAISS, Chroma, Pinecone, or Weaviate)
- **Batching**: Group 20-50 topics per embedding call
- **Latency Goal**: <1s per source addition (for <1k topics)
- **Process**: Embed new topics → compare with vector DB → return merge candidates

### 6. Cost ✅
**Decision**: Optimized embedding + selective LLM calls
- **Embedding Cost**: `text-embedding-3-small` ~$0.02 per 1M tokens (~100 topics = <$0.001 per doc)
- **Cost Target**: <$0.005 per added source
- **LLM Calls**: Limit to topic merge reasoning when needed, full summary regen only on user demand
- **Optimization**: Cache all embeddings and summaries per source

---

## 🎯 Next Steps

1. **Review this plan** with team
2. **Answer open questions** 
3. **Prioritize phases** based on impact
4. **Create detailed tickets** for each phase
5. **Start implementation** with Phase 1

---

## 📚 References

- NotebookLM: https://notebooklm.google/
- Semantic Similarity: https://www.sbert.net/
- Topic Modeling: https://en.wikipedia.org/wiki/Topic_model
- Knowledge Graph: https://en.wikipedia.org/wiki/Knowledge_graph

