# Technical Implementation Specification

## Source Merge Flow - Detailed Implementation Plan

Based on the research and decisions made, this document outlines the technical implementation details.

---

## 🎯 Implementation Parameters

### Core Parameters

| Parameter                          | Value                    | Notes                                  |
| ---------------------------------- | ------------------------ | -------------------------------------- |
| **Topic Merge Threshold (High)**   | 0.85                     | Merge as same topic                    |
| **Topic Merge Threshold (Medium)** | 0.60-0.85                | Related topic (subtopic/complementary) |
| **Topic Merge Threshold (Low)**    | <0.60                    | New/unique topic                       |
| **Summary Length**                 | 1500-2000 chars          | ~250-300 words                         |
| **Summary Regeneration Frequency** | Every 5 sources          | OR on user request                     |
| **Embedding Model**                | `text-embedding-3-small` | OpenAI or MiniLM                       |
| **Latency Target**                 | <1s                      | Per source addition                    |
| **Cost Target**                    | <$0.005                  | Per added source                       |
| **Vector DB**                      | FAISS (local)            | Or Chroma/Pinecone/Weaviate            |

---

## 🏗️ Architecture Components

### 1. Vector Database for Topic Embeddings

**Purpose**: Store topic embeddings for fast similarity search

**Schema**:

```typescript
type TopicEmbedding = {
  topicId: string; // Unique topic identifier
  chatId: string; // Chat this topic belongs to
  documentId: string; // Source document
  topicTitle: string; // Topic title
  topicDescription: string; // Topic description (short)
  embedding: number[]; // Vector embedding (1536 dims for text-embedding-3-small)
  topicData: TopicNode; // Full topic data (pages, subtopics, etc.)
  createdAt: Date; // When topic was added
};
```

**Operations**:

- `addTopicEmbedding(topic: TopicEmbedding)`: Add new topic embedding
- `findSimilarTopics(embedding: number[], threshold: number)`: Find similar topics
- `updateTopicEmbedding(topicId: string, embedding: TopicEmbedding)`: Update existing topic
- `getTopicsByChatId(chatId: string)`: Get all topics for a chat

**Implementation**:

- Use FAISS (Facebook AI Similarity Search) for local storage
- Alternative: Chroma DB for persistent storage
- Batch embeddings: Group 20-50 topics per API call

---

### 2. Topic Merging Service

**Purpose**: Intelligent topic merging using semantic similarity

**Functions**:

#### `embedTopic(topic: TopicNode): Promise<number[]>`

- Embed topic title + description
- Use `text-embedding-3-small` model
- Cache result in vector DB

#### `findMergeCandidates(newTopic: TopicNode, existingTopics: TopicNode[], threshold: number): Promise<MergeCandidate[]>`

```typescript
type MergeCandidate = {
  existingTopic: TopicNode;
  similarity: number;
  relationship: "same" | "related" | "new";
  mergeStrategy: "expand" | "complement" | "create";
};
```

**Algorithm**:

1. Embed new topic (title + description)
2. Query vector DB for similar topics (threshold-based)
3. Calculate cosine similarity for each candidate
4. Classify relationship:
   - ≥0.85: `same` → merge/expand
   - 0.60-0.85: `related` → complement/subtopic
   - <0.60: `new` → create separate topic
5. Return merge candidates with strategies

#### `mergeTopics(existing: TopicNode, incoming: TopicNode, strategy: 'expand' | 'complement'): TopicNode`

- **expand**: Merge pages, combine subtopics, enrich description
- **complement**: Create subtopic relationship, keep separate but linked

---

### 3. Summary Merging Service

**Purpose**: Intelligent summary merging with delta tracking

**Functions**:

#### `generateDeltaSummary(newSource: Source, existingSummary: string): Promise<string>`

- Extract key insights from new source
- Compare with existing summary
- Generate concise delta (100-200 chars)
- Format: "New insights from [Source]: [key points]"

#### `mergeSummaries(existingSummary: string, deltaSummaries: string[], regenerate: boolean = false): Promise<string>`

- **If regenerate** (every 5 sources or on request):
  - Use AI to generate unified summary from all sources
  - Target: 1500-2000 characters
  - Preserve key insights from all sources
- **If delta mode**:
  - Append delta summaries to existing summary
  - Maintain length limit (2000 chars)
  - Truncate oldest deltas if needed

**Summary Structure**:

```
[Main Summary - 1200-1500 chars]
[Recent Deltas - 300-500 chars]
  • Source 2: Added topic X with examples
  • Source 3: Expanded topic Y with advanced concepts
  • Source 4: Introduced topic Z
```

---

### 4. Relationship Detection Service

**Purpose**: Detect relationships between sources and topics

**Functions**:

#### `detectRelationships(newSource: Source, existingSources: Source[]): Promise<Relationship[]>`

```typescript
type Relationship = {
  sourceId1: string;
  sourceId2: string;
  type: "complementary" | "expands" | "contradictory" | "repeats";
  description: string;
  confidence: number;
  topics: string[]; // Affected topics
};
```

**Detection Strategy**:

1. **Complementary**: Topics from different sources that enhance each other
2. **Expands**: New source adds depth/examples to existing topics
3. **Contradictory**: Conflicting claims (use semantic similarity + keyword detection)
4. **Repeats**: High similarity (>0.90) between source summaries

**Implementation**:

- Use topic embeddings to find complementary/expanding relationships
- Use keyword detection for contradictions (e.g., "faster" vs "slower")
- Use summary similarity for repeat detection

---

### 5. Conflict Resolution Service

**Purpose**: Handle contradictory information gracefully

**Functions**:

#### `annotateConflict(topic: TopicNode, conflictingSources: Source[]): TopicNode`

- Add conflict annotation to topic
- Keep both perspectives
- Generate neutral description

**Conflict Annotation Structure**:

```typescript
type ConflictAnnotation = {
  status: "conflict";
  sources: string[];
  perspectives: Array<{
    sourceId: string;
    claim: string;
  }>;
  resolution: string; // Neutral description
};
```

**Example Output**:

```
"Source A states that `trap` automatically cleans up child processes,
while Source B notes manual cleanup is needed — these may differ by
Bash version or implementation details."
```

---

## 🔄 Updated Flow Implementation

### Flow 1: Adding First Source (New Chat)

```
1. User uploads PDF/link/text
   ↓
2. Individual Analysis (Stage 1)
   - Extract summary, topics, metadata
   - Store in temporary object
   ↓
3. Embed Topics
   - Embed all topics (title + description)
   - Store in vector DB
   - Batch: Group all topics in one API call
   ↓
4. Create Knowledge Base
   - globalSummary = source.summary (truncate to 2000 chars)
   - globalTopics = source.mainTopics
   - sources = [source]
   - relationships = []
   ↓
5. Create Message
   - Show "AI Tutor Analysis Complete"
   - Display document card with topics
   - Show summary
   ↓
6. Save to Database
   - Save to chat_contexts table
   - Save topic embeddings to vector DB
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
3. Embed New Topics
   - Embed new topics (title + description)
   - Batch: Group all new topics in one API call
   ↓
4. Load Existing Knowledge Base
   - Fetch from chat_contexts table
   - Load topic embeddings from vector DB
   ↓
5. Find Merge Candidates (Topic Merging)
   - For each new topic:
     - Query vector DB for similar topics (threshold: 0.85)
     - Calculate similarity scores
     - Classify relationship (same/related/new)
     - Determine merge strategy
   ↓
6. Merge Topics
   - For same topics (≥0.85): Expand existing topic
   - For related topics (0.60-0.85): Create subtopic or complement
   - For new topics (<0.60): Add as new topic
   - Update topic embeddings in vector DB
   ↓
7. Detect Relationships
   - Compare new source with existing sources
   - Detect complementary, expands, contradictory, repeats
   - Generate relationship descriptions
   ↓
8. Generate Delta Summary
   - Extract key insights from new source
   - Compare with existing summary
   - Generate concise delta (100-200 chars)
   ↓
9. Update Knowledge Base
   - Add new source to sources array
   - Update globalSummary (append delta or regenerate if needed)
   - Update globalTopics (merged topic tree)
   - Add relationships
   - Handle conflicts (annotate, don't overwrite)
   ↓
10. Create Message
    - Text message: Conversational delta (what's new)
    - PDFUploadMessage part: Document card for NEW source
    - Update existing sources panel
    ↓
11. Save to Database
    - Update chat_contexts table
    - Update topic embeddings in vector DB
    - Save new message
    - Keep existing messages intact
```

---

## 📊 Performance Optimizations

### 1. Embedding Caching

- **Strategy**: Cache all topic embeddings in vector DB
- **Update**: Only re-embed when topic description changes
- **Storage**: FAISS index or Chroma collection per chat

### 2. Batch Processing

- **Embeddings**: Group 20-50 topics per API call
- **Similarity Search**: Batch query vector DB
- **LLM Calls**: Minimize to essential operations only

### 3. Lazy Regeneration

- **Summary**: Only regenerate every 5 sources or on user request
- **Topics**: Only re-merge when explicitly needed
- **Relationships**: Update incrementally, not full recalculation

### 4. Vector DB Optimization

- **Indexing**: Use FAISS IndexFlatIP (inner product) for cosine similarity
- **Sharding**: One index per chat (scales horizontally)
- **Memory**: Keep recent embeddings in memory, older ones on disk

---

## 💰 Cost Optimization

### 1. Embedding Costs

- **Model**: `text-embedding-3-small` ($0.02 per 1M tokens)
- **Estimate**: ~100 topics = <$0.001 per document
- **Caching**: Only embed new topics, reuse existing embeddings

### 2. LLM Calls

- **Topic Merging**: Use embeddings + rules (no LLM needed for similarity)
- **Summary Merging**: Only call LLM for regeneration (every 5 sources)
- **Delta Summaries**: Use lightweight extraction (no LLM)
- **Relationship Detection**: Use embeddings + keyword detection (minimal LLM)

### 3. Cost Target

- **Per Source**: <$0.005
- **Breakdown**:
  - Embeddings: ~$0.001
  - LLM (if needed): ~$0.002-0.003
  - Storage: Negligible

---

## 🗄️ Database Schema Updates

### 1. Update `chat_contexts` Table

```sql
ALTER TABLE chat_contexts ADD COLUMN IF NOT EXISTS relationships JSONB DEFAULT '[]'::jsonb;
ALTER TABLE chat_contexts ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 0;
ALTER TABLE chat_contexts ADD COLUMN IF NOT EXISTS last_summary_regeneration TIMESTAMP;
ALTER TABLE chat_contexts ADD COLUMN IF NOT EXISTS delta_summaries JSONB DEFAULT '[]'::jsonb;
```

**New Fields**:

- `relationships`: Array of relationship objects
- `source_count`: Track number of sources (for regeneration trigger)
- `last_summary_regeneration`: Timestamp of last full regeneration
- `delta_summaries`: Array of delta summary objects

### 2. Create `topic_embeddings` Table (if using SQL-based vector DB)

```sql
CREATE TABLE IF NOT EXISTS topic_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chat_contexts(chat_id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  topic_id VARCHAR(255) NOT NULL,
  topic_title TEXT NOT NULL,
  topic_description TEXT,
  embedding VECTOR(1536),  -- For text-embedding-3-small
  topic_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chat_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_embeddings_chat ON topic_embeddings(chat_id);
CREATE INDEX IF NOT EXISTS idx_topic_embeddings_embedding ON topic_embeddings USING ivfflat (embedding vector_cosine_ops);
```

**Note**: If using FAISS (local), this table is not needed. Use in-memory index files instead.

---

## 🔧 Implementation Files

### New Files to Create

1. **`lib/ai/topic-merging.ts`**

   - Topic embedding functions
   - Merge candidate detection
   - Topic merging logic

2. **`lib/ai/summary-merging.ts`**

   - Delta summary generation
   - Summary merging logic
   - Regeneration triggers

3. **`lib/ai/relationship-detection.ts`**

   - Relationship detection algorithms
   - Conflict annotation
   - Relationship storage

4. **`lib/vector-db/faiss-index.ts`** (or `chroma-client.ts`)

   - Vector DB operations
   - Embedding storage
   - Similarity search

5. **`lib/ai/context-merge-v2.ts`**
   - Updated context merging with new logic
   - Integration of all services
   - Main merge orchestration

### Files to Update

1. **`lib/ai/context-merge.ts`**

   - Update to use new merging services
   - Add relationship tracking
   - Add delta summary support

2. **`lib/db/schema.ts`**

   - Add new fields to `chat_contexts`
   - Add `topic_embeddings` table (if needed)

3. **`lib/db/queries.ts`**

   - Update `upsertChatContext()` to handle new fields
   - Add topic embedding queries
   - Add relationship queries

4. **`app/actions/add-source-to-chat.ts`**

   - Integrate new merging pipeline
   - Add topic embedding step
   - Add relationship detection

5. **`app/actions/upload-and-ingest.ts`**
   - Integrate new merging pipeline
   - Add topic embedding step
   - Add relationship detection

---

## 🧪 Testing Strategy

### Unit Tests

1. **Topic Embedding**

   - Test embedding generation
   - Test similarity calculation
   - Test merge candidate detection

2. **Topic Merging**

   - Test same topic merge (≥0.85)
   - Test related topic merge (0.60-0.85)
   - Test new topic creation (<0.60)
   - Test conflict handling

3. **Summary Merging**

   - Test delta summary generation
   - Test summary appending
   - Test summary regeneration
   - Test length limits

4. **Relationship Detection**
   - Test complementary detection
   - Test expands detection
   - Test contradictory detection
   - Test repeats detection

### Integration Tests

1. **Full Pipeline**

   - Add first source → verify knowledge base creation
   - Add second source → verify merging
   - Add third source → verify relationships
   - Add conflicting source → verify conflict annotation

2. **Performance Tests**
   - Test embedding latency (<1s)
   - Test similarity search latency
   - Test full pipeline latency
   - Test cost per source (<$0.005)

### E2E Tests

1. **User Flow**
   - Add PDF → Add Link → Add Text
   - Verify knowledge base updates
   - Verify message structure
   - Verify UI updates
   - Verify sources panel

---

## 📈 Success Metrics

### Technical Metrics

- **Latency**: <1s per source addition
- **Cost**: <$0.005 per source
- **Accuracy**: >90% topic merge accuracy
- **Performance**: <100ms similarity search

### UX Metrics

- **User Satisfaction**: Improved with unified knowledge base
- **Clarity**: Clear delta messages
- **Navigation**: Easy source relationship understanding
- **Consistency**: Unified topic tree across sources

---

## 🚀 Prioritized Implementation Plan

### Step 0: Quick Wins (Week 1) ⚡

**Goal**: Fix immediate UX issues for consistent base experience

**Tasks**:

1. **Fix Missing Document Cards**

   - Always create `PDFUploadMessage` part for new sources (even in existing chats)
   - Update `upload-and-ingest.ts` to always include PDFUploadMessage part
   - Update `add-source-to-chat.ts` to create PDFUploadMessage part for link/text sources

2. **Improve Delta Messages**

   - Enhance `mergeSourceIntoContext()` to generate more contextual delta messages
   - Add source title and key topics to delta message
   - Make delta messages more informative and conversational

3. **Test Current Flow**
   - Verify document cards appear for all source types
   - Verify delta messages are clear and informative
   - Verify sources panel updates correctly

**Files to Update**:

- `app/actions/upload-and-ingest.ts`
- `app/actions/add-source-to-chat.ts`
- `lib/ai/context-merge.ts`

**Success Criteria**:

- ✅ All sources show document cards in messages
- ✅ Delta messages are clear and informative
- ✅ Sources panel updates correctly
- ✅ No regressions in existing functionality

---

### Step 1: Schema Update (Week 1-2) 🗄️

**Goal**: Add relationship and origin fields for future intelligent merging

**Tasks**:

1. **Update `chat_contexts` Table**

   - Add `relationships` JSONB field
   - Add `source_count` INTEGER field
   - Add `last_summary_regeneration` TIMESTAMP field
   - Add `delta_summaries` JSONB field
   - Keep existing fields for backward compatibility

2. **Update TypeScript Types**

   - Update `ChatContext` type with new fields
   - Create `Relationship` type
   - Create `DeltaSummary` type
   - Update `ChatContextSource` type if needed

3. **Update Database Queries**

   - Update `upsertChatContext()` to handle new fields
   - Add graceful handling for missing fields (backward compatibility)
   - Update `getChatContext()` to return new fields

4. **Create Migration**
   - Create SQL migration file
   - Test migration on development database
   - Ensure backward compatibility

**Files to Update**:

- `lib/db/schema.ts`
- `lib/db/queries.ts`
- `lib/db/migrations/` (new migration file)

**Success Criteria**:

- ✅ Schema updated with new fields
- ✅ Types updated correctly
- ✅ Queries handle new fields gracefully
- ✅ Migration runs successfully
- ✅ Backward compatibility maintained

---

### Step 2: Vector DB Setup (Week 2-3) 🔍

**Goal**: Build FAISS/Chroma store for topic embeddings

**Tasks**:

1. **Choose Vector DB Solution**

   - Evaluate FAISS vs Chroma vs PostgreSQL pgvector
   - Consider: persistence, performance, ease of use
   - Recommendation: Start with FAISS (local) or Chroma (persistent)

2. **Set Up Vector DB**

   - Install dependencies (faiss-node or chromadb)
   - Create vector DB client/service
   - Set up index structure (1536 dimensions for text-embedding-3-small)

3. **Implement Basic Operations**

   - `addTopicEmbedding(topic: TopicEmbedding)`
   - `findSimilarTopics(embedding: number[], threshold: number)`
   - `getTopicsByChatId(chatId: string)`
   - `updateTopicEmbedding(topicId: string, embedding: TopicEmbedding)`

4. **Test Performance**
   - Test embedding storage latency
   - Test similarity search latency (<100ms target)
   - Test with 100, 500, 1000 topics
   - Verify <1s total latency for source addition

**Files to Create**:

- `lib/vector-db/faiss-index.ts` or `lib/vector-db/chroma-client.ts`
- `lib/vector-db/types.ts`

**Files to Update**:

- `package.json` (add vector DB dependency)

**Success Criteria**:

- ✅ Vector DB set up and working
- ✅ Basic operations implemented
- ✅ Performance targets met (<100ms search, <1s total)
- ✅ Can store and query topic embeddings

---

### Step 3: Topic Embedding Service (Week 3-4) 🧠

**Goal**: Foundation for similarity and merging

**Tasks**:

1. **Implement Embedding Generation**

   - Create `embedTopic(topic: TopicNode): Promise<number[]>`
   - Use `text-embedding-3-small` model
   - Embed topic title + description (concatenated)
   - Batch embeddings (20-50 topics per API call)

2. **Implement Embedding Storage**

   - Store embeddings in vector DB
   - Cache embeddings (don't re-embed if topic unchanged)
   - Link embeddings to chatId and documentId

3. **Implement Similarity Search**

   - Calculate cosine similarity
   - Query vector DB for similar topics
   - Return top-k similar topics with scores

4. **Test Embedding Service**
   - Test embedding generation
   - Test similarity calculation accuracy
   - Test batch processing performance
   - Test caching behavior

**Files to Create**:

- `lib/ai/topic-embedding.ts`

**Files to Update**:

- `lib/vector-db/faiss-index.ts` (or chroma-client.ts)

**Success Criteria**:

- ✅ Can generate topic embeddings
- ✅ Can store embeddings in vector DB
- ✅ Can search for similar topics
- ✅ Batch processing works correctly
- ✅ Caching prevents duplicate embeddings

---

### Step 4: Topic Merging Service (Week 4-5) 🔗

**Goal**: Implement threshold logic for intelligent topic merging

**Tasks**:

1. **Implement Merge Candidate Detection**

   - Create `findMergeCandidates(newTopic: TopicNode, existingTopics: TopicNode[], threshold: number)`
   - Use topic embeddings for similarity search
   - Classify relationships: same (≥0.85), related (0.60-0.85), new (<0.60)
   - Determine merge strategy for each candidate

2. **Implement Topic Merging Logic**

   - Create `mergeTopics(existing: TopicNode, incoming: TopicNode, strategy: 'expand' | 'complement')`
   - **expand**: Merge pages, combine subtopics, enrich description
   - **complement**: Create subtopic relationship, keep separate but linked
   - Handle page number merging
   - Handle subtopic merging

3. **Implement Conflict Detection**

   - Detect contradictory information
   - Annotate conflicts (don't overwrite)
   - Generate neutral conflict descriptions

4. **Test Topic Merging**
   - Test same topic merge (≥0.85)
   - Test related topic merge (0.60-0.85)
   - Test new topic creation (<0.60)
   - Test conflict handling

**Files to Create**:

- `lib/ai/topic-merging.ts`

**Files to Update**:

- `lib/ai/topic-embedding.ts`

**Success Criteria**:

- ✅ Can detect merge candidates accurately
- ✅ Can merge topics correctly (expand/complement)
- ✅ Can handle conflicts gracefully
- ✅ Merge accuracy >90%

---

### Step 5: Summary Merging + Delta Logic (Week 5-6) 📝

**Goal**: Handle narrative blending with delta summaries

**Tasks**:

1. **Implement Delta Summary Generation**

   - Create `generateDeltaSummary(newSource: Source, existingSummary: string): Promise<string>`
   - Extract key insights from new source
   - Compare with existing summary
   - Generate concise delta (100-200 chars)
   - Format: "New insights from [Source]: [key points]"

2. **Implement Summary Merging**

   - Create `mergeSummaries(existingSummary: string, deltaSummaries: string[], regenerate: boolean = false)`
   - **Delta mode**: Append delta summaries (maintain 2000 char limit)
   - **Regeneration mode**: Use AI to generate unified summary (every 5 sources or on request)
   - Handle truncation (remove oldest deltas if needed)

3. **Implement Regeneration Triggers**

   - Track source count
   - Trigger regeneration every 5 sources
   - Allow manual regeneration on user request
   - Store regeneration timestamp

4. **Test Summary Merging**
   - Test delta summary generation
   - Test summary appending
   - Test summary regeneration
   - Test length limits

**Files to Create**:

- `lib/ai/summary-merging.ts`

**Files to Update**:

- `lib/ai/context-merge.ts`

**Success Criteria**:

- ✅ Can generate delta summaries
- ✅ Can merge summaries correctly
- ✅ Regeneration triggers work
- ✅ Length limits enforced
- ✅ Summaries are concise and informative

---

### Step 6: Relationship Detection (Week 6-7) 🔗

**Goal**: Annotate contradictions and expansions

**Tasks**:

1. **Implement Relationship Detection**

   - Create `detectRelationships(newSource: Source, existingSources: Source[]): Promise<Relationship[]>`
   - Detect **complementary**: Topics that enhance each other
   - Detect **expands**: New source adds depth/examples
   - Detect **contradictory**: Conflicting claims (semantic + keyword)
   - Detect **repeats**: High similarity (>0.90) between summaries

2. **Implement Conflict Annotation**

   - Create `annotateConflict(topic: TopicNode, conflictingSources: Source[]): TopicNode`
   - Keep both perspectives
   - Generate neutral descriptions
   - Tag conflicts for later resolution

3. **Implement Relationship Storage**

   - Store relationships in `chat_contexts.relationships`
   - Link relationships to topics
   - Track confidence scores

4. **Test Relationship Detection**
   - Test complementary detection
   - Test expands detection
   - Test contradictory detection
   - Test repeats detection

**Files to Create**:

- `lib/ai/relationship-detection.ts`

**Files to Update**:

- `lib/ai/context-merge.ts`
- `lib/db/queries.ts`

**Success Criteria**:

- ✅ Can detect all relationship types
- ✅ Can annotate conflicts correctly
- ✅ Relationships stored correctly
- ✅ Detection accuracy >85%

---

### Step 7: UI Integration (Week 7-8) 🎨

**Goal**: Let users see merged context and relationships visually

**Tasks**:

1. **Update Knowledge Overview Component**

   - Show global summary (merged from all sources)
   - Show unified topic tree (merged topics)
   - Show source indicators on topics
   - Show relationships between sources

2. **Update Sources Panel**

   - Show relationships between sources
   - Show what each source adds (delta info)
   - Show topic coverage per source
   - Show conflict indicators

3. **Update Message Structure**

   - Show contextual delta messages
   - Show source relationships in messages
   - Update existing messages when new sources added
   - Show conflict annotations

4. **Update Document Cards**

   - Show merged topic tree
   - Show source relationships
   - Show conflict indicators
   - Show delta information

5. **Test UI Integration**
   - Test knowledge overview display
   - Test sources panel updates
   - Test message structure
   - Test document cards
   - Test user interactions

**Files to Update**:

- `components/knowledge-overview.tsx`
- `components/source-panel.tsx`
- `components/messages/pdf-upload-message.tsx`
- `components/chat.tsx`

**Success Criteria**:

- ✅ Users can see merged context
- ✅ Users can see relationships
- ✅ Users can see conflicts
- ✅ UI updates correctly
- ✅ User experience is intuitive

---

### Step 8: Testing & Polish (Week 8-9) 🧪

**Goal**: Comprehensive testing and optimization

**Tasks**:

1. **Unit Tests**

   - Test all new services
   - Test topic embedding
   - Test topic merging
   - Test summary merging
   - Test relationship detection

2. **Integration Tests**

   - Test full pipeline
   - Test adding multiple sources
   - Test conflict handling
   - Test regeneration triggers

3. **Performance Tests**

   - Test embedding latency
   - Test similarity search latency
   - Test full pipeline latency
   - Test cost per source

4. **Optimization**

   - Optimize embedding caching
   - Optimize batch processing
   - Optimize vector DB queries
   - Reduce LLM calls

5. **UI/UX Polish**
   - Improve delta messages
   - Improve relationship display
   - Improve conflict visualization
   - Improve overall UX

**Success Criteria**:

- ✅ All tests passing
- ✅ Performance targets met
- ✅ Cost targets met
- ✅ UX is polished
- ✅ No regressions

---

### Step 9: Rollout (Week 9-10) 🚀

**Goal**: Gradual rollout with monitoring

**Tasks**:

1. **Feature Flag Setup**

   - Create feature flag for new merging system
   - Allow gradual rollout
   - Allow quick rollback if needed

2. **Monitoring Setup**

   - Set up metrics tracking
   - Monitor latency
   - Monitor costs
   - Monitor error rates

3. **Gradual Rollout**

   - Start with 10% of users
   - Monitor metrics
   - Increase to 50%
   - Increase to 100%

4. **Documentation**
   - Document new features
   - Document API changes
   - Document migration guide
   - Update user docs

**Success Criteria**:

- ✅ Feature flag working
- ✅ Metrics tracked
- ✅ Gradual rollout successful
- ✅ Documentation complete
- ✅ Full rollout completed

---

## 📚 References

- **FAISS**: https://github.com/facebookresearch/faiss
- **Chroma DB**: https://www.trychroma.com/
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **Cosine Similarity**: https://en.wikipedia.org/wiki/Cosine_similarity
- **Vector Databases**: https://www.pinecone.io/learn/vector-database/

---

## ✅ Immediate Next Steps (Prioritized)

### Step 0: Quick Wins (Start Here) ⚡

1. **Fix missing document cards**

   - Update `upload-and-ingest.ts` to always create PDFUploadMessage part
   - Update `add-source-to-chat.ts` to create PDFUploadMessage part for link/text
   - Test with existing chats

2. **Improve delta messages**
   - Enhance `mergeSourceIntoContext()` delta message generation
   - Make messages more contextual and informative
   - Test message clarity

### Step 1: Schema Update (Next)

1. **Update database schema**

   - Add new fields to `chat_contexts` table
   - Create migration file
   - Update TypeScript types

2. **Update database queries**
   - Update `upsertChatContext()` to handle new fields
   - Ensure backward compatibility
   - Test migration

### Step 2: Vector DB Setup (After Schema)

1. **Choose and set up vector DB**

   - Evaluate FAISS vs Chroma
   - Set up chosen solution
   - Implement basic operations

2. **Test performance**
   - Verify <100ms search latency
   - Verify <1s total latency
   - Test with various topic counts

### Steps 3-9: Follow Implementation Plan

Continue with remaining steps in order, testing each step before moving to the next.
