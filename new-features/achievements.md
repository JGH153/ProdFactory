# Achievements System — Feature Proposal & Implementation Plan

## Overview

An **Achievements & Milestones** system that gives players visible goals, tracks progression, and rewards completion with permanent production bonuses. Achievements persist across game resets, giving long-term meaning to repeated playthroughs.

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
| `research-novice` | Research Novice | Max out any 1 research type | +3% production |
| `research-master` | Research Master | Max out all 8 research types | +10% production |
| `shop-spree` | Shop Spree | Activate all 4 shop boosts at once | +5% production |
| `nuclear-stockpile` | Nuclear Stockpile | Produce 100 Nuclear Pasta (lifetime) | +10% production |

**Total maximum bonus: +69%** — significant but not game-breaking (the shop boost alone gives 20x).

### Rewards

Each completed achievement grants a permanent multiplicative production bonus applied to all resource runs. The achievement multiplier integrates into the existing production chain alongside research and shop boosts:

```
produced = producers × productionBoost × continuousMul × researchMul × achievementMul
```

Where `achievementMul = 1 + (sum of completed reward percentages / 100)`.

### Persistence Across Resets

Achievements survive full game resets. They're stored at a separate Redis key (`achievements:{sessionId}`) so the reset endpoint — which calls `createInitialGameState()` — doesn't touch them. A matching localStorage key (`prodfactory-achievements`) provides instant client-side rendering.

### UI: New 5th Tab

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

**Migration**: Save version bumps from 5 → 6. Existing saves default `lifetimeProduced` to `bigNumZero` (acceptable — it's a new feature).

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

Conditions use a discriminated union (`resource-produced`, `total-producers`, `resource-unlocked`, `resource-automated`, `continuous-mode`, `max-research-count`, `all-boosts-active`) with type-specific fields.

### Achievement Checking

Runs **client-side on each game tick** (inside the RAF loop in `game-state-context.tsx`). Iterates ~12 achievements, skips completed ones, evaluates simple conditions. Negligible overhead.

After offline progress is applied, the first tick auto-detects any newly completed achievements.

### Provider Architecture

Achievement context slots between `MilestoneNotificationProvider` and `GameStateProvider`:

```
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
| `GET /api/game` | Also loads `achievements:{sessionId}` from Redis, passes to `computeOfflineProgress`, returns in response |
| `POST /api/game/save` | Accepts optional `achievements` in body, saves to `achievements:{sessionId}` |
| `POST /api/game/sync` | Same as save; also passes achievements to `checkPlausibility` for correct max production |
| `POST /api/game/reset` | No change needed — separate Redis key is untouched |

### Plausibility Integration

The plausibility system must account for the achievement multiplier when computing `maxProduction`. Otherwise, legitimate achievement-boosted production would be flagged as cheating.

---

## Files to Create

| File | Purpose |
|---|---|
| `src/game/achievements/achievement-types.ts` | Type definitions: AchievementId, AchievementConfig, AchievementState, condition types |
| `src/game/achievements/achievement-config.ts` | ACHIEVEMENT_CONFIGS record, ACHIEVEMENT_ORDER array, 12 achievement definitions |
| `src/game/achievements/achievement-checker.ts` | `checkAchievements` and `evaluateCondition` pure functions |
| `src/game/achievements/achievement-logic.ts` | `getAchievementMultiplier`, `computeProgress` helpers |
| `src/game/achievements/achievement-context.tsx` | `AchievementProvider` and `useAchievements` context + hook |
| `src/game/achievements/achievement-persistence.ts` | localStorage save/load for achievements |
| `src/components/achievements/achievement-page.tsx` | Main Achievements tab page component |
| `src/components/achievements/achievement-card.tsx` | Individual achievement card with progress bar |

## Files to Modify

| File | Changes |
|---|---|
| `src/game/types.ts` | Add `lifetimeProduced: BigNum` to `ResourceState` |
| `src/game/initial-state.ts` | Add `lifetimeProduced: bigNumZero` to each resource's initial state |
| `src/game/logic.ts` | Add `achievements` param to `completeRun`, apply achievement multiplier, increment `lifetimeProduced` |
| `src/game/state/serialization.ts` | Add `lifetimeProduced` to SerializedResourceState, bump SAVE_VERSION to 6, handle migration |
| `src/game/state/game-state-context.tsx` | Consume `useAchievements`, pass to `completeRun`, run `checkAchievements` in tick, include in save/sync |
| `src/game/state/milestone-context.tsx` | Add `"achievement"` notification kind, `"achievements"` to NavigateTab, `showAchievement` callback |
| `src/providers/app-providers.tsx` | Add `AchievementProvider` between `MilestoneNotificationProvider` and `GameStateProvider` |
| `src/lib/server/redis.ts` | Add `loadAchievements`, `saveAchievements` functions for `achievements:{sessionId}` key |
| `src/lib/server/offline-progress.ts` | Accept achievements param, apply achievement multiplier, increment `lifetimeProduced` |
| `src/lib/server/plausibility.ts` | Accept achievements param, apply achievement multiplier in maxProduction |
| `src/lib/api-client.ts` | Update request/response types to include achievements in save/sync/load |
| `src/app/api/game/route.ts` | Load achievements from Redis, pass to `computeOfflineProgress`, include in response |
| `src/app/api/game/save/route.ts` | Extract and save achievements from request body |
| `src/app/api/game/sync/route.ts` | Extract and save achievements, pass to plausibility check |
| `src/components/layout/bottom-nav.tsx` | Add `"achievements"` tab with trophy icon |
| `src/app/page.tsx` | Add `"achievements"` to ActiveTab, render `AchievementPage` |

## Test Files

| File | Purpose |
|---|---|
| `src/game/achievements/achievement-checker.test.ts` | Unit tests for all condition evaluators |
| `src/game/achievements/achievement-logic.test.ts` | Unit tests for multiplier calculation, progress computation |
| `src/components/achievements/achievement-page.test.tsx` | Component tests for achievements UI |
| `src/test/msw-handlers.ts` (modify) | Include achievements in load/save mock responses |
| `src/test/render-with-providers.tsx` (modify) | Wrap with `AchievementProvider` |
| `src/test/fixtures.ts` (modify) | Add achievement state fixtures, add `lifetimeProduced` to resource fixtures |

---

## Implementation Sequence

### Phase 1 — Data Layer
1. Add `lifetimeProduced` to types, initial state, serialization (bump save version)
2. Increment `lifetimeProduced` in `completeRun` and `computeOfflineProgress`
3. Create achievement types, config, and initial state factory

### Phase 2 — Achievement Logic
4. Create `achievement-checker.ts` with condition evaluators
5. Create `achievement-logic.ts` with multiplier and progress functions
6. Write unit tests for all achievement logic

### Phase 3 — Persistence
7. Add Redis load/save functions for achievements
8. Create `achievement-persistence.ts` for localStorage
9. Modify `GET /api/game` to load and return achievements
10. Modify `POST /api/game/save` and `POST /api/game/sync` to accept and store achievements
11. Update `api-client.ts` to send/receive achievements
12. Update `offline-progress.ts` and `plausibility.ts` to accept achievements

### Phase 4 — Client Integration
13. Create `AchievementProvider` with context, localStorage loading, server reconciliation
14. Add to provider tree in `app-providers.tsx` (parent of `GameStateProvider`)
15. Add achievement checking to game tick
16. Pass achievement multiplier into `completeRun`
17. Update `useServerSync` to send achievements with save/sync

### Phase 5 — UI
18. Create `AchievementPage` and `AchievementCard` components
19. Add achievements tab to `BottomNav` and `page.tsx`
20. Add achievement notification to `MilestoneNotificationProvider`
21. Write component tests

### Phase 6 — Polish
22. Update test infrastructure (fixtures, MSW handlers, render-with-providers)
23. Run `pnpm validate` — all tests, Biome, TypeScript, Knip must pass

---

## Edge Cases

- **BigNum thresholds**: `bnGte` handles arbitrarily large comparisons safely
- **Offline progress**: Server increments `lifetimeProduced`, client detects achievements on first tick after return
- **Plausibility system**: Must include achievement multiplier to avoid false correction flags
- **`exactOptionalPropertyTypes`**: Use conditional spread `...(achievements && { achievements })` instead of assigning `undefined`
- **Game reset dialog**: Update copy to mention achievements persist ("Achievements are kept")
- **Reconciliation**: Achievements are one-directional (false → true), so client/server reconciliation takes the union (OR)
