This plan is already implemented and only serve as documentation

# ProdFactory Architecture Improvement Plan

## Context

ProdFactory is a well-built incremental game with solid foundations: pure game logic functions, immutable state, strict TypeScript, optimistic concurrency, and server-side plausibility checking. However, as the codebase has grown, several files have become monoliths, business logic is duplicated across client/server/plausibility layers, and the component layer has coupling issues. This plan addresses modularity, readability, flexibility, and robustness — in that priority order.

---

## Phase 1: Shared Production Math (High Impact)

**Problem**: The production formula (multipliers, run timing, continuous mode) is computed independently in 4 places: `logic.ts` (completeRun + startRun), `offline-progress.ts`, `plausibility.ts`, and UI components (ProgressBar, RunButton). Each reimplements the same multiplier stacking. A change to the formula requires updates in all 4 locations — a guaranteed bug source.

### 1A. Extract `src/game/production.ts` — Unified production calculator

Create a single module that owns the complete production math:

```
getProductionMultipliers({ state, resourceId }) → { productionMul, continuousMul, researchMul, prestigeMul, runTimeMultiplier, totalPerRun }
getMaxRunsInPeriod({ resourceId, producers, runTimeMultiplier, elapsedSeconds }) → number
getProductionForRuns({ runs, producers, productionMul, continuousMul, researchMul, prestigeMul }) → BigNum
```

**Files to modify**:
- Create: `src/game/production.ts`
- Refactor callers:
  - `src/game/logic.ts` — `completeRun`, `startRun`, `canStartRun` use `getProductionMultipliers`
  - `src/lib/server/offline-progress.ts` — replace inline multiplier computation
  - `src/lib/server/plausibility.ts` — `computeMaxProduction` uses shared calculator
  - `src/components/resource/progress-bar.tsx` — derive from shared function
- Create: `src/game/production.test.ts`

**Why**: Single source of truth for game math. Bugs in production formulas become impossible to have in only one layer. Offline progress, plausibility, and UI are guaranteed to agree.

**Complexity**: Medium

### 1B. Extract `src/game/research-calculator.ts` — Shared research time advancement

The "advance research levels given elapsed time" loop is duplicated between `offline-progress.ts` (lines 96-105) and `plausibility.ts` (`computeMaxResearchLevel`, lines 47-67). Extract to a shared function.

```
advanceResearchLevels({ startLevel, elapsedMs, researchTimeMultiplier }) → { newLevel, remainingMs }
```

**Files to modify**:
- Create: `src/game/research-calculator.ts` (move from `plausibility.ts:computeMaxResearchLevel`)
- Refactor: `src/lib/server/offline-progress.ts` — use shared function
- Refactor: `src/lib/server/plausibility.ts` — use shared function
- Refactor: `src/game/research-logic.ts` — `advanceResearchWithReport` uses shared function

**Why**: Research time calculation appears in 3 places with subtle differences. A unified function prevents drift.

**Complexity**: Small

---

## Phase 2: Game Logic Decomposition (High Impact)

**Problem**: `logic.ts` is 679 lines containing run timing, production, costs, unlocking, automation, prestige, and shop boosts. It's hard to navigate and each concern bleeds into the others.

### 2A. Split `src/game/logic.ts` into focused modules

| New Module | Functions Moved | Lines |
|---|---|---|
| `src/game/run-timing.ts` | `getRunTimeMultiplier`, `getEffectiveRunTime`, `isContinuousMode`, `getContinuousMultiplier`, `getClampedRunTime`, `getSpeedMilestone`, `SPEED_MILESTONE_INTERVAL`, `CONTINUOUS_THRESHOLD` | ~95 |
| `src/game/producers.ts` | `getProducerCost`, `canBuyProducer`, `buyProducer`, `getMaxAffordableProducers`, `buyMaxProducers` | ~90 |
| `src/game/runs.ts` | `canStartRun`, `startRun`, `isRunComplete`, `completeRun`, `getRunInputCost` | ~165 |
| `src/game/automation.ts` | `canBuyAutomation`, `buyAutomation`, `togglePause` | ~50 |
| `src/game/unlocking.ts` | `canUnlock`, `unlockResource` | ~60 |
| `src/game/shop-boosts.ts` | `activateBoost`, `resetShopBoosts` | ~30 |
| `src/game/prestige-logic.ts` | `computeCouponsEarned`, `canPrestige`, `performPrestige` | ~75 |

Delete `src/game/logic.ts` and update all imports to point directly to the new modules (clean break, no barrel file).

**Files to modify**:
- Create 7 new files (listed above)
- Delete `src/game/logic.ts`
- Split `src/game/logic.test.ts` into per-module test files
- Update all import sites to use specific modules (game-state-context, progress-bar, run-button, offline-progress, plausibility, etc.)

**Why**: Each module has a single responsibility. Finding "how does run timing work?" means opening one 95-line file instead of scanning 679 lines. New features (e.g., new boost types) touch only the relevant module.

**Complexity**: Large (many import updates, but mechanical)

---

## Phase 3: API Layer Consolidation (Medium Impact)

**Problem**: `api-helpers.ts` (690 lines) contains 7 body parsers with identical boilerplate (JSON parse → isRecord → validate fields → validate serverVersion), 4 action executors with duplicated version-conflict handling, and plausibility persistence logic. Each body parser repeats ~25 lines of identical JSON/record/version validation.

### 3A. Generic body parser builder

Replace 7 hand-written parsers with a composable builder:

```ts
const parseBody = createBodyParser({
  fields: {
    resourceId: { validate: isValidResourceId, error: "Invalid resourceId" },
    serverVersion: { validate: isNonNegativeInteger, error: "Invalid serverVersion" },
  },
});
```

This eliminates ~150 lines of duplicated parsing code.

**Files to modify**:
- `src/lib/server/api-helpers.ts` — replace `parseResourceActionBody`, `parseBoostActionBody`, `parseLabActionBody`, `parseLabResearchActionBody`, `parseVersionOnlyBody` with builder
- `src/lib/server/api-helpers.test.ts` — update tests

**Why**: Adding a new action type currently requires writing another 25-line parser. With the builder, it's a 5-line declaration.

**Complexity**: Medium

### 3B. Extract unified action executor

The 4 executors (`executeAction`, `executeSimpleAction`, `executeLabAction`, `executeBoostAction`) share identical structure: session validation → body parsing → load state → version check → deserialize → apply → serialize → save → patch snapshot. The only differences are: (1) body parser, (2) action signature, (3) post-action hook (boost executor advances research).

Extract a single generic executor:

```ts
const executeGameAction = async <TBody>({
  request,
  parseBody,
  applyAction,
  afterApply,
}: {
  request: NextRequest;
  parseBody: (request: NextRequest) => Promise<TBody | NextResponse>;
  applyAction: (args: { state: GameState } & TBody) => GameState;
  afterApply?: (args: { state: GameState }) => GameState;
}) => { ... };
```

**Files to modify**:
- `src/lib/server/api-helpers.ts` — replace 4 executors with 1 generic
- May need to update `src/app/api/game/activate-boost/route.ts` to pass `afterApply`

**Why**: Eliminates ~200 lines of duplicated version-conflict/state-load/serialize/save logic. New action types become trivial to add.

**Complexity**: Medium

### 3C. Make `assign-research` consistent

Currently `src/app/api/game/assign-research/route.ts` is the only route that doesn't use a shared executor — it has ~60 lines of inline logic. Refactor to use `executeGameAction` with a composed action function.

**Files to modify**:
- `src/app/api/game/assign-research/route.ts`
- `src/game/research-logic.ts` — ensure `assignResearch` has the right signature for the executor

**Why**: Consistency. Every route should follow the same pattern.

**Complexity**: Small

---

## Phase 4: GameStateProvider Decomposition (Medium Impact)

**Problem**: `game-state-context.tsx` (457 lines) is a god object: holds game state, runs the RAF game loop, manages offline progress, and exposes 17 action methods. Every state change re-renders every consumer.

### 4A. Extract game loop into `src/game/hooks/use-game-loop.ts`

Move the RAF tick logic (lines 153-241) into a dedicated hook:

```ts
const useGameLoop = ({ state, setState, showMilestone, showResearchLevelUp }) => { ... };
```

**Files to modify**:
- Create: `src/game/hooks/use-game-loop.ts`
- Modify: `src/game/state/game-state-context.tsx` — call `useGameLoop` instead of inline useEffect

**Why**: The game loop is an independent concern. Separating it makes the provider easier to read and the loop independently testable.

**Complexity**: Small

### 4B. Extract awaited action pattern into a helper

Lines 298-419 contain 7 nearly identical `useCallback` blocks that all do:
```ts
try {
  const serverState = await executeAwaitedAction({ endpoint, ...params });
  reconcileState({ state: serverState, fullReplace: false });
  return true;
} catch { return false; }
```

Extract a factory:

```ts
const createAwaitedAction = <TParams>(
  endpoint: string,
  getParams: (args: TParams) => Record<string, unknown>,
  fullReplace = false,
) => useCallback(async (args: TParams) => {
  try {
    const serverState = await executeAwaitedAction({ endpoint, ...getParams(args) });
    reconcileState({ state: serverState, fullReplace });
    return true;
  } catch { return false; }
}, [executeAwaitedAction, reconcileState]);
```

This removes ~100 lines of boilerplate from the provider.

**Why**: Readability. The provider should clearly show *what* actions exist, not repeat the same try/catch pattern 7 times.

**Complexity**: Small

---

## Phase 5: Component Layer Improvements (Medium Impact)

### 5A. Create `useResourceRuntime` hook

Multiple components (ProgressBar, RunButton, ResourceCard) independently compute `rtm`, `effectiveRunTime`, `clampedRunTime`, `isContinuous`, `continuousMul` for the same resource. Extract a hook:

```ts
const useResourceRuntime = (resource: ResourceState) => {
  const { state } = useGameState();
  // Compute once, return all derived values
  return { rtm, effectiveRunTime, clampedRunTime, isContinuous, continuousMul, productionMul, researchMul, perRun };
};
```

**Files to modify**:
- Create: `src/game/hooks/use-resource-runtime.ts`
- Modify: `src/components/resource/progress-bar.tsx` — use hook instead of inline computation
- Modify: `src/components/resource/run-button.tsx` — use hook
- Modify: `src/components/resource/resource-card.tsx` — pass derived values down

**Why**: Removes duplicated computation across components. Single place to adjust if production formula changes.

**Complexity**: Small

### 5B. SFX audio pooling

`SfxProvider` creates a new `Audio` object for every sound play, never cleaning up. Replace with a pool:

```ts
const audioPool = new Map<string, HTMLAudioElement>();
const getAudio = (src: string) => {
  let audio = audioPool.get(src);
  if (!audio) {
    audio = new Audio(src);
    audioPool.set(src, audio);
  }
  audio.currentTime = 0;
  return audio;
};
```

**Files to modify**:
- `src/game/state/sfx-context.tsx`

**Why**: Prevents unbounded Audio object creation. Fixes potential memory leak on rapid clicking.

**Complexity**: Small

---

## Phase 6: Robustness (Lower Impact, High Value)

### 6A. React Error Boundary

Add an error boundary that catches render crashes and shows a recovery UI (with "Reset Game" option) instead of a white screen.

**Files to modify**:
- Create: `src/components/error-boundary.tsx`
- Modify: `src/providers/app-providers.tsx` — wrap provider stack with error boundary

**Why**: Any uncaught error in the game loop or component tree currently crashes the entire app with no recovery path.

**Complexity**: Small

### 6B. Serialization error handling

`deserializeGameState` silently falls back to initial state on any error. Add structured error logging so issues are visible:

```ts
// Before: silently returns initial state
// After: logs the error, returns initial state
```

**Files to modify**:
- `src/game/state/serialization.ts` — add logger.warn on deserialization fallback
- `src/game/state/persistence.ts` — add logger.warn on localStorage parse failure

**Why**: Silent failures make state corruption invisible. A player's progress could be silently reset without anyone knowing why.

**Complexity**: Small

### 6C. Per-session action rate limiting

Currently only session creation is rate-limited. Add per-session rate limiting for game actions (e.g., 60 actions/minute) to protect against automated abuse.

**Files to modify**:
- `src/lib/server/api-helpers.ts` — add rate limit check in the generic executor
- `src/lib/server/rate-limit.ts` — may need a new rate limit key pattern

**Why**: Without this, a malicious client can spam save/buy/sync endpoints at high frequency, hitting Redis unnecessarily.

**Complexity**: Small

---

## Implementation Order

The phases are designed to be implemented sequentially, with each phase building on the previous:

1. **Phase 1** (Production math) — foundation for all other changes
2. **Phase 2** (Logic decomposition) — depends on Phase 1 for clean module boundaries
3. **Phase 3** (API consolidation) — independent of Phase 2, can be parallelized
4. **Phase 4** (Provider decomposition) — depends on Phase 1 for `useResourceRuntime`
5. **Phase 5** (Component improvements) — depends on Phase 1 and 4
6. **Phase 6** (Robustness) — independent, can be done at any time

## Verification

After each phase:
1. Run `pnpm validate` (Biome + TypeScript + Knip + tests) — all must pass
2. Run `pnpm dev` and manually verify: start a run, buy producers, check continuous mode, buy automation, research, prestige
3. Verify the browser console shows no errors or warnings
4. For Phase 1 specifically: compare offline-progress output before/after to ensure production numbers are identical
