---
name: integrity-check
description: Audit game mechanic changes for consistency across plausibility checks, offline progress, research, prestige, save/sync, and test coverage. Run after any change to multipliers, production rates, state shape, or game formulas.
user-invocable: true
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# Integrity Check

Audit a game mechanic change for consistency across the plausibility anti-cheat system, offline progress, research, prestige, save/sync, and tests. This is a **semantic audit** — it reads code to verify logical consistency, not just run tests.

## When to use

After any change that touches production rates, multipliers, run timing, research timing, prestige formulas, state shape, coupon upgrades, shop boosts, or offline progress.

## Steps

### 1. Identify the change scope

Run `git diff HEAD` (or `git diff --cached` if staged) to see what changed. Classify into:
- **Multiplier change** — affects production output (production-2x, prestige passive, research efficiency, coupon upgrades)
- **Timing change** — affects run time or research time (speed boosts, speed milestones, automation-2x)
- **State shape change** — adds/removes/renames fields on GameState or sub-types
- **Formula change** — modifies cost scaling, coupon calculation, or other core formulas
- **New mechanic** — entirely new system (new boost, new upgrade type, new resource)

### 2. Audit plausibility system

Read `src/lib/server/plausibility.ts` and verify:

**`checkPlausibility`:**
- If a new multiplier was added, does the max production calculation account for it? It must use the most generous interpretation to avoid false positives.
- If run timing changed, does `getClampedRunTime` / continuous multiplier still receive all relevant parameters?
- If research changed, does the research validation loop still correctly compute max achievable level?
- If prestige changed, does `getPrestigePassiveMultiplier` still receive trusted snapshot-sourced data (not client-claimed)?
- Does the tolerance (1.15x + 1 run grace) still make sense?

**`buildProtectedState`:**
- If a new server-authoritative field was added (producers, unlocks, automation, boosts, labs, prestige counts, coupon upgrades), is it overlaid from `referenceState`?
- If a new client-updatable field was added (amounts, runStartedAt, nuclearPastaProducedThisRun), is it passed through?

**`buildSyncSnapshot`:**
- If new data is needed for future plausibility comparisons, is it captured? Check `SyncSnapshot` type in `src/lib/server/redis.ts`.

**`stripServerVersion`:**
- If a new top-level field was added to GameState, is it included?

### 3. Audit offline progress

Read `src/lib/server/offline-progress.ts` and verify:
- If a new multiplier was added, does `computeOfflineProgress` account for it **identically** to `checkPlausibility`? These must agree — if offline progress grants more than plausibility allows, syncs trigger false corrections.
- If research timing changed, does offline research use the shared `advanceResearchLevels` from `src/game/research-calculator.ts`?

### 4. Audit research system (if research changed)

Read `src/game/research-config.ts`, `src/game/research-logic.ts`, `src/game/research-calculator.ts`:
- If max level changed, is `getMaxLevelForResearch` updated?
- If research time formula changed, is `advanceResearchLevels` (shared by offline + plausibility) updated?
- If a new research type was added, is it in `RESEARCH_ORDER` and the `ResearchId` union type?
- Does `getResearchTimeMultiplier` still correctly combine all timing factors?

### 5. Audit prestige system (if prestige changed)

Read `src/game/prestige-config.ts`, `src/game/prestige-logic.ts`:
- Does `computeCouponsEarned` handle BigNum edge cases (very large values)?
- Does `getPrestigePassiveMultiplier` use `lifetimeCoupons` (not `couponBalance`)?
- Does `performPrestige` correctly preserve: shop boosts, lab unlocks, research levels, coupon upgrades?
- Does `performPrestige` correctly reset: resources, producers, automation, run progress?
- Are milestones still applied correctly?

### 6. Audit save/sync flow

Read `src/lib/server/api-helpers.ts`, `src/lib/server/api-validation.ts`, `src/game/state/serialization.ts`:
- Does `persistWithPlausibility` still call `buildProtectedState` before `checkPlausibility`?
- Does `patchSnapshotMetadata` capture any new fields?
- Does `validateSerializedGameState` validate new fields?
- Does `serializeGameState` / `deserializeGameState` round-trip the new field?

### 7. Audit action endpoints (if a new action was added)

Read the relevant route in `src/app/api/game/`:
- Does it use `executeGameAction` for server-authoritative mutations?
- Does `patchSnapshotMetadata` run after the action?
- Is the action rate-limited via `checkActionRateLimit`?

### 8. Verify test coverage

For each changed file, check the corresponding test file:

| Source | Test |
|--------|------|
| `src/lib/server/plausibility.ts` | `src/lib/server/plausibility.test.ts` |
| `src/game/research-logic.ts` | `src/game/research-logic.test.ts` |
| `src/game/research-calculator.ts` | `src/game/research-calculator.test.ts` |
| `src/game/prestige-logic.ts` | `src/game/prestige-logic.test.ts` |
| `src/game/prestige-config.ts` | `src/game/prestige-config.test.ts` |
| `src/game/run-timing.ts` | `src/game/run-timing.test.ts` |
| `src/game/production.ts` | `src/game/production.test.ts` |
| `src/lib/server/offline-progress.ts` | `src/lib/server/offline-progress.test.ts` |

Verify:
- New multipliers/parameters have plausibility test cases exercising them
- Formula changes have edge case tests (zero, maximum, boundary values)
- New state fields have serialization round-trip tests
- Add missing tests

### 9. Run targeted tests

Run only the relevant subset:

```bash
# Plausibility
pnpm vitest run src/lib/server/plausibility.test.ts

# Research
pnpm vitest run src/game/research-logic.test.ts src/game/research-calculator.test.ts

# Prestige
pnpm vitest run src/game/prestige-logic.test.ts src/game/prestige-config.test.ts

# Offline progress
pnpm vitest run src/lib/server/offline-progress.test.ts

# Run timing / production
pnpm vitest run src/game/run-timing.test.ts src/game/production.test.ts
```

Then run `pnpm typecheck` to catch type errors from state shape changes.

### 10. Report findings

Summarize:
1. Which integrity checks passed
2. Which issues were found and fixed
3. Which tests were added or need to be added
4. Any remaining risks or edge cases
