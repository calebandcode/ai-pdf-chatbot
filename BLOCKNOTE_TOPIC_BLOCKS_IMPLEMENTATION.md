# BlockNote Topic Blocks Implementation Plan

## Overview
Restore interactive topic/subtopic structure within BlockNote editor while maintaining rich editing capabilities.

## Architecture Decision

### Challenge
BlockNote's `createBlockSpec` uses ProseMirror node views, not React components. The `render` function returns DOM elements, not React components.

### Solution: Hybrid Rendering Approach

Instead of trying to force React components into BlockNote's rendering pipeline, we'll:

1. **Store topic blocks in BlockNote** (as custom blocks with all props)
2. **Render them as React components** (intercept during rendering)
3. **Use BlockNote for editable content** (explanations, notes, Q&A)

## Implementation Strategy

### Phase 1: Enhanced Schema ✅ (DONE)
- Added `collapsed`, `history`, `isGenerating`, `pages` props to `topicExplanationBlockSpec`

### Phase 2: React Component Wrapper
Create a component that:
- Intercepts `topicExplanation` blocks from BlockNote
- Renders them as interactive React components
- Manages collapse/expand state
- Handles button clicks (Generate, Quiz, Ask Question)

### Phase 3: Block Interception System
- Use BlockNote's `onChange` to detect topic blocks
- Render React components for topic blocks
- Keep standard BlockNote rendering for other blocks
- Maintain block order and hierarchy

### Phase 4: State Management
- Collapse state stored in block props (persisted to DB)
- Loading states managed locally (not persisted)
- History stored in block props (last 3-5 versions)

### Phase 5: Interactive Features
- Generate Explanation button → calls `generateTopicExplanationAction`
- Quiz button → opens quiz modal with topic context
- Ask Question button → opens topic chat
- Edit button → switches to editable BlockNote content

### Phase 6: Visual Hierarchy
- Compute depth from `parentTopicId` chain
- Apply indentation based on depth
- Visual grouping with borders/backgrounds
- Collapse/expand animations

### Phase 7: Delta Updates
- Store history in block props
- Compare new explanation with previous
- Show diff or merge changes
- Allow rollback to previous version

## Technical Approach

### Option A: Pre-render Interception (RECOMMENDED)
Before inserting blocks into BlockNote:
1. Separate topic blocks from standard blocks
2. Render topic blocks as React components
3. Insert standard blocks into BlockNote
4. Position topic components between BlockNote blocks

**Pros:**
- Full React component control
- Easy to add interactivity
- Clear separation of concerns

**Cons:**
- Need to manage block ordering manually
- More complex insertion logic

### Option B: Post-render Override
After BlockNote renders:
1. Find all `topicExplanation` blocks in DOM
2. Replace with React components
3. Maintain BlockNote's block structure

**Pros:**
- Leverages BlockNote's rendering
- Automatic block ordering

**Cons:**
- DOM manipulation complexity
- Potential conflicts with BlockNote's updates
- Harder to maintain

### Option C: Custom BlockNote Extension
Create a BlockNote extension that:
1. Registers custom React component renderer
2. Integrates with BlockNote's rendering pipeline
3. Handles state updates

**Pros:**
- Most integrated solution
- Cleanest architecture

**Cons:**
- Requires deep BlockNote knowledge
- May not be supported in current version
- Highest complexity

## Recommended: Option A (Pre-render Interception)

### Implementation Steps

1. **Modify `unified-notebook-editor.tsx`**:
   - Separate blocks into: `topicBlocks`, `standardBlocks`
   - Render topic blocks as React components
   - Insert standard blocks into BlockNote
   - Maintain order using React keys

2. **Create `TopicBlockRenderer` component**:
   - Takes topic block props
   - Renders interactive UI (collapse, buttons)
   - Handles state updates
   - Calls server actions

3. **Update block conversion**:
   - Keep topic blocks as `topicExplanation` type
   - Don't convert them to standard blocks
   - Pass them to `TopicBlockRenderer`

4. **State synchronization**:
   - When topic block state changes (collapse, explanation generated)
   - Update block in BlockNote editor
   - Trigger auto-save

## Next Steps

1. ✅ Phase 1: Enhanced schema (DONE)
2. ⏭️ Phase 2: Create `TopicBlockRenderer` component
3. ⏭️ Phase 3: Modify `unified-notebook-editor` to intercept topic blocks
4. ⏭️ Phase 4: Implement collapse/expand functionality
5. ⏭️ Phase 5: Add interactive buttons
6. ⏭️ Phase 6: Implement visual hierarchy
7. ⏭️ Phase 7: Add delta updates









