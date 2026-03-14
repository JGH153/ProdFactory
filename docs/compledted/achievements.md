This plan is already implemented and only serve as documentation

# Achievements System — Feature Proposal & Implementation Plan

## Overview

An **Achievements & Milestones** system that gives players visible goals, tracks progression, and rewards completion with permanent production bonuses. Achievements persist across game resets and prestiges, giving long-term meaning to repeated playthroughs.

---

## Feature Design

### 12 Achievements

| ID | Name | Condition | Reward |
|---|---|---|---|
| `iron-hoarder` | Iron Hoarder | Produce 1M Iron Ore (lifetime) | +5% production |
| `plate-empire` | Plate Empire | Produce 100K Plates (lifetime) | +5% production |
| `full-chain` | Full Chain | Unlock Nuclear Pasta | +5% production |
| `first-automation` | First Automation | Automate any 1 resource | +3% production |
| `full-automation` | Full Automation | Automate all 8 resources | +10% production |
| `speed-demon` | Speed Demon | Reach continuous mode on any resource | +5% production |
| `producer-army-50` | Growing Factory | Own 50 total producers (across all tiers) | +3% production |
| `producer-army-200` | Industrial Titan | Own 200 total producers (across all tiers) | +5% production |
| `research-novice` | Research Novice | Max out any 1 research type (level 20 for efficiency/speed, level 12 for offline-progress) | +3% production |
| `research-master` | Research Master | Max out all 8 efficiency research types (`more-*` at level 20) | +10% production |
| `shop-spree` | Shop Spree | Activate all 5 shop boosts at once (`production-2x`, `automation-2x`, `runtime-50`, `research-2x`, `offline-2h`) | +5% production |
| `nuclear-stockpile` | Nuclear Stockpile | Produce 100 Nuclear Pasta (lifetime) | +10% production |

**Total maximum bonus: +69%** — significant but not game-breaking (the shop boost alone gives 2x).

### Rewards

Each completed achievement grants a permanent multiplicative production bonus applied to all resource runs. The achievement multiplier integrates into the existing production chain alongside research and shop boosts:

```
produced = producers × productionBoost × continuousMul × researchMul × prestigeMul × achievementMul
```

Where `achievementMul = 1 + (sum of completed reward percentages / 100)`.

### Persistence Across Resets

Achievements survive full game resets and prestiges. They're stored at a separate Redis key (`achievements:{sessionId}`) so the reset endpoint — which calls `createInitialGameState()` — doesn't touch them. A matching localStorage key (`prodfactory-achievements`) provides instant client-side rendering.

### UI: New Tab

A new "Achievements" tab in the bottom navigation (between Research and Settings) with:

- **Summary banner** at top showing total bonus and completion count (e.g., "7/12 completed — +34% production")
- **Achievement cards** with name, description, icon, progress bar, and completion status
- **Completed cards** get a green border treatment (matching the shop boost active style)

Toast notifications pop when achievements are completed, navigating to the Achievements tab on click.

---

## Technical Design

### New Concept: Lifetime Production Tracking

Current `ResourceState.amount` represents the spendable balance. For production-based achievements, we need **lifetime production** — total amount ever produced, never decreasing.

Add `lifetimeProduced: BigNum` to `ResourceState`. Incremented in `completeRun` (alongside `amount`) and in `computeOfflineProgress`. Uses `bnGte` for threshold comparisons (safe for arbitrarily large BigNum values).

**Migration**: Save version bumps from 1 → 2. Existing Redis saves use `?? bnSerialize(bigNumZero)` fallback in `deserializeResource`. Existing localStorage saves are discarded (version mismatch).

### Prestige Preservation

`performPrestige` in `src/game/prestige-logic.ts` calls `createInitialGameState()` for fresh resources. `lifetimeProduced` must be explicitly preserved from the old state for each resource after getting fresh resources, since lifetime production should never reset.

### Achievement State Model

```typescript
type AchievementId = "iron-hoarder" | "plate-empire" | ... ; // 12 IDs

type AchievementState = Record<AchievementId, boolean>; // true = completed

type AchievementConfig = {
  id: AchievementId;
  name: string;
  description: string;
  rewardPercent: number;
  condition: AchievementCondition; // discriminated union
};
```

Conditions use a discriminated union (`resource-produced`, `total-producers`, `resource-unlocked`, `any-automated`, `all-automated`, `continuous-mode`, `max-research-any`, `all-efficiency-research-maxed`, `all-boosts-active`) with type-specific fields.

### Achievement Checking

Runs **client-side on each game tick** (inside the RAF loop in `game-state-context.tsx`). Iterates ~12 achievements, skips completed ones, evaluates simple conditions. Negligible overhead.

After offline progress is applied, the first tick auto-detects any newly completed achievements.

### Provider Architecture

Achievement context slots between `MilestoneNotificationProvider` and `GameStateProvider`:

```
ErrorBoundary
  QueryClientProvider
    TooltipProvider
      SfxProvider
        MilestoneNotificationProvider
          AchievementProvider          ← NEW
            GameStateProvider
              ...app
```

This avoids circular dependencies: `GameStateProvider` reads achievements for the production multiplier, and writes back newly completed achievements.

### API Changes

No new endpoints. Achievements piggyback on existing save/sync:

| Endpoint | Change |
|---|---|
| `GET /api/game` | Also loads `achievements:{sessionId}` from Redis, computes `achievementMul`, passes to `computeOfflineProgress`, returns achievements in response |
| `POST /api/game/save` | Accepts optional `achievements` in body, saves to `achievements:{sessionId}`, computes `achievementMul` for `persistWithPlausibility` |
| `POST /api/game/sync` | Same as save; passes `achievementMul` to `persistWithPlausibility` for correct max production |
| `POST /api/game/time-warp` | Loads achievements from Redis, computes `achievementMul`, passes to `computeTimeWarp` |
| `POST /api/game/reset` | No change needed — separate Redis key is untouched |

### Plausibility Integration

The plausibility system must account for the achievement multiplier when computing `maxProduction`. The `achievementMul` parameter threads through `persistWithPlausibility` (in `src/lib/server/api-helpers.ts`) → `checkPlausibility` (in `src/lib/server/plausibility.ts`) → `getProductionForRuns` (in `src/game/production.ts`).

---

## Files to Create

| File | Purpose |
|---|---|
| `src/game/achievements/achievement-types.ts` | Type definitions: AchievementId, AchievementConfig, AchievementState, condition discriminated union, `createInitialAchievementState()` |
| `src/game/achievements/achievement-config.ts` | ACHIEVEMENT_CONFIGS record, ACHIEVEMENT_ORDER array, 12 achievement definitions |
| `src/game/achievements/achievement-checker.ts` | `checkAchievements` and `evaluateCondition` pure functions |
| `src/game/achievements/achievement-multiplier.ts` | `getAchievementMultiplier`, `computeAchievementProgress` helpers |
| `src/game/achievements/achievement-context.tsx` | `AchievementProvider` and `useAchievements` context + hook |
| `src/game/achievements/achievement-persistence.ts` | localStorage save/load for `prodfactory-achievements` key |
| `src/components/achievements/achievement-page.tsx` | Main Achievements tab page component |
| `src/components/achievements/achievement-card.tsx` | Individual achievement card with progress bar |

## Files to Modify

| File | Changes |
|---|---|
| `src/game/types.ts` | Add `lifetimeProduced: BigNum` to `ResourceState` |
| `src/game/initial-state.ts` | Add `lifetimeProduced: bigNumZero` to each resource's initial state |
| `src/game/runs.ts` | Add optional `achievementMul` param to `completeRun`, pass to `getProductionParams`, increment `lifetimeProduced` |
| `src/game/production.ts` | Add `achievementMul` to `ProductionParams`, `getProductionParams`, `getPerRunProduction`, and `getProductionForRuns` (default 1) |
| `src/game/prestige-logic.ts` | After `createInitialGameState()`, preserve `lifetimeProduced` from old state for each resource |
| `src/game/state/serialization.ts` | Add `lifetimeProduced` to `SerializedResourceState`, bump `SAVE_VERSION` to 2, add v1 migration fallback |
| `src/game/state/game-state-context.tsx` | Consume `useAchievements`, pass `achievementMul` to game loop, call `updateAchievements` on tick, include achievements in save/sync |
| `src/game/hooks/use-game-loop.ts` | Accept `achievementMul` param, pass to `completeRun` |
| `src/game/state/use-server-sync.ts` | Include achievements in save/sync request bodies, pass server achievements from initial load |
| `src/game/state/milestone-context.tsx` | Add `"achievement"` notification kind, `"achievements"` to `NavigateTab`, `showAchievement` callback |
| `src/providers/app-providers.tsx` | Add `AchievementProvider` between `MilestoneNotificationProvider` and `GameStateProvider` |
| `src/lib/server/redis.ts` | Add `loadAchievements`, `saveAchievements` functions for `achievements:{sessionId}` key (30-day TTL) |
| `src/lib/server/offline-progress.ts` | Accept `achievementMul` param (default 1), pass to `getProductionForRuns`, increment `lifetimeProduced`. Forward through `computeTimeWarp` |
| `src/lib/server/plausibility.ts` | Accept `achievementMul` param (default 1), pass to `getProductionForRuns` in max production calculation |
| `src/lib/server/api-helpers.ts` | Add `achievementMul` param to `persistWithPlausibility`, forward to `checkPlausibility` |
| `src/lib/api-client.ts` | Add `achievements` to `LoadGameResponse`, save/sync request bodies (conditional spread) |
| `src/app/api/game/route.ts` | Load achievements from Redis, compute `achievementMul`, pass to `computeOfflineProgress`, include in response |
| `src/app/api/game/save/route.ts` | Parse optional `achievements` from body, save to Redis, compute `achievementMul` for `persistWithPlausibility` |
| `src/app/api/game/sync/route.ts` | Same as save route |
| `src/app/api/game/time-warp/route.ts` | Load achievements from Redis, compute `achievementMul`, pass to `computeTimeWarp` |
| `src/components/layout/bottom-nav.tsx` | Add `"achievements"` tab with trophy icon (Hugeicons) between Research and Settings |
| `src/app/page.tsx` | Add `"achievements"` to `ActiveTab`, render `AchievementPage`, handle navigation |
| `src/game/state/use-flush-on-exit.ts` | Include achievements in sendBeacon payload |

## Test Files

| File | Purpose |
|---|---|
| `src/game/achievements/achievement-checker.test.ts` | Unit tests for all 12 condition evaluators |
| `src/game/achievements/achievement-multiplier.test.ts` | Unit tests for multiplier calculation, progress computation |
| `src/components/achievements/achievement-page.test.tsx` | Component tests for achievements UI |
| `src/test/msw-handlers.ts` (modify) | Include achievements in load/save mock responses |
| `src/test/render-with-providers.tsx` (modify) | Wrap with `AchievementProvider` |
| `src/test/fixtures.ts` (modify) | Add `createAchievementState` helper, `lifetimeProduced` auto-included via serialization |

---

## Implementation Sequence

### Phase 1 — Data Layer
1. Add `lifetimeProduced` to `ResourceState` type, initial state, serialization (bump `SAVE_VERSION` 1→2, v1 fallback)
2. Increment `lifetimeProduced` in `completeRun` (`src/game/runs.ts`) and `computeOfflineProgress` (`src/lib/server/offline-progress.ts`)
3. Preserve `lifetimeProduced` across prestige in `performPrestige` (`src/game/prestige-logic.ts`)

### Phase 2 — Achievement Types + Logic
4. Create `achievement-types.ts` with all types and `createInitialAchievementState()`
5. Create `achievement-config.ts` with 12 achievement definitions
6. Create `achievement-checker.ts` with condition evaluators
7. Create `achievement-multiplier.ts` with multiplier and progress functions
8. Write unit tests for checker and multiplier

### Phase 3 — Production Integration
9. Add `achievementMul` parameter to `getProductionParams`, `getPerRunProduction`, `getProductionForRuns` (`src/game/production.ts`)
10. Add `achievementMul` to `completeRun` (`src/game/runs.ts`)
11. Add `achievementMul` to `computeOfflineProgress` and `computeTimeWarp` (`src/lib/server/offline-progress.ts`)
12. Add `achievementMul` to `checkPlausibility` (`src/lib/server/plausibility.ts`) and `persistWithPlausibility` (`src/lib/server/api-helpers.ts`)

### Phase 4 — Persistence
13. Add `loadAchievements`, `saveAchievements` to `src/lib/server/redis.ts`
14. Create `achievement-persistence.ts` for localStorage
15. Update `GET /api/game`, `POST /api/game/save`, `POST /api/game/sync`, `POST /api/game/time-warp` routes
16. Update `src/lib/api-client.ts` request/response types

### Phase 5 — Client Integration
17. Create `AchievementProvider` with context, localStorage loading, server reconciliation (OR-merge)
18. Add to provider tree in `app-providers.tsx` (between MilestoneNotificationProvider and GameStateProvider)
19. Wire into `game-state-context.tsx`: pass `achievementMul` to game loop, call `updateAchievements` on tick
20. Wire into `use-game-loop.ts`: accept and forward `achievementMul`
21. Wire into `use-server-sync.ts`: include achievements in save/sync payloads
22. Wire into flush-on-exit: include achievements in beacon

### Phase 6 — Notifications
23. Add `"achievement"` notification kind and `"achievements"` to `NavigateTab` in milestone context
24. Add `showAchievement` callback and toast rendering

### Phase 7 — UI
25. Create `AchievementCard` component
26. Create `AchievementPage` component with summary banner and card list
27. Add `"achievements"` tab to `BottomNav` and `page.tsx`

### Phase 8 — Polish
28. Update test infrastructure (fixtures, MSW handlers, render-with-providers)
29. Write component tests for achievement page
30. Run `pnpm validate` — all tests, Biome, TypeScript, Knip must pass

---

## Edge Cases

- **BigNum thresholds**: `bnGte` handles arbitrarily large comparisons safely
- **Offline progress**: Server increments `lifetimeProduced`, client detects achievements on first tick after return
- **Plausibility system**: Must include achievement multiplier to avoid false correction flags
- **`exactOptionalPropertyTypes`**: Use conditional spread `...(achievements && { achievements })` instead of assigning `undefined`
- **Game reset dialog**: Update copy to mention achievements persist ("Achievements are kept")
- **Prestige**: `lifetimeProduced` is preserved from old state (never resets); achievements are in separate Redis key (untouched)
- **Reconciliation**: Achievements are one-directional (false → true), so client/server reconciliation takes the union (OR)
- **Shop-spree edge case**: If a player activates all 5 boosts then resets boosts, the achievement stays completed
- **v1 Redis migration**: `deserializeResource` uses `data.lifetimeProduced ?? bnSerialize(bigNumZero)` fallback
