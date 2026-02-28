# Prestige System Design — FICSIT Evaluation

## Overview

When a player's factory reaches Nuclear Pasta production, FICSIT Corp evaluates the operation and awards **Coupons** — a permanent prestige currency. The player then **dismantles the factory** and rebuilds from Iron Ore, keeping their Coupons, prestige upgrades, and research levels. Each cycle is faster than the last thanks to coupon bonuses and upgrades.

**Design pillars:**

1. **Clear goal** — reach Nuclear Pasta, stockpile, prestige.
2. **Always feel stronger** — every prestige makes the next run noticeably faster.
3. **Meaningful choices** — upgrade tree forces prioritization of limited coupons.
4. **Respect player time** — research levels carry over (the slowest grind), milestones compress early game.

---

## Prestige Currency — Coupons

### Earning Formula

```
couponsEarned = floor(sqrt(nuclearPastaProduced))
```

Where `nuclearPastaProduced` is the **total Nuclear Pasta produced this run** (not current amount — counts everything produced even if consumed). Uses square-root scaling so each prestige rewards pushing further, but with diminishing returns.

**Example progression:**

| Nuclear Pasta Produced | Coupons Earned |
|------------------------|----------------|
| 1                      | 1              |
| 4                      | 2              |
| 9                      | 3              |
| 25                     | 5              |
| 100                    | 10             |
| 1,000                  | 31             |
| 10,000                 | 100            |

### Passive Bonus

Every coupon **ever earned** (lifetime total, not current balance) gives **+2% all production**. Spending coupons on upgrades does NOT reduce this bonus — it is based on lifetime earnings.

- 5 lifetime coupons → +10% (1.1x)
- 50 lifetime coupons → +100% (2x)
- 250 lifetime coupons → +500% (6x)

This ensures every prestige feels rewarding even before buying upgrades.

### Tracking

- `couponBalance` — spendable coupons (earned minus spent)
- `lifetimeCoupons` — total coupons earned across all prestiges (never decreases)
- `nuclearPastaProducedThisRun` — tracks production for coupon calculation (resets on prestige)

---

## What Resets / What Stays

### Resets on Prestige

- All resource amounts → 0
- All producers → 0 (Iron Ore gets 1 free, as with new game)
- All unlocked tiers → only Iron Ore unlocked
- All automation unlocks → locked (unless preserved by prestige upgrade/milestone)
- All shop boosts → deactivated
- Run timers → cleared
- Lab assignments → cleared (labs stay unlocked per research retention)

### Persists Through Prestige

- **Research levels** — all 8 research types keep their current level (0–10)
- **Lab unlock status** — if labs were unlocked, they stay unlocked
- **Coupon balance** — current spendable coupons
- **Lifetime coupons** — cumulative total
- **Prestige upgrades** — all purchased upgrades are permanent
- **Prestige count** — number of times prestiged (for milestones)
- **Nuclear Pasta produced this run** tracker resets; lifetime stats preserved
- **Settings** — music, SFX, volume (obviously)

---

## Prestige Availability

### When Can You Prestige?

The prestige button becomes **visible** once the player **unlocks Nuclear Pasta** (tier 7). It becomes **clickable** once at least 1 Nuclear Pasta has been produced (guaranteeing at least 1 coupon).

### First Prestige Timing

~2–3 hours of active play. The player must:

1. Progress through all 8 resource tiers (Iron Ore → Nuclear Pasta)
2. Produce at least 1 Nuclear Pasta
3. Choose to prestige (never forced)

### Pre-Prestige Preview

Before confirming, show a modal with:

- **Coupons to earn**: calculated from current Nuclear Pasta produced
- **New lifetime total**: current lifetime + earned
- **New passive bonus**: +2% × new lifetime total
- **What you keep**: research levels, prestige upgrades, coupons
- **What you lose**: resources, producers, automation, shop boosts, tier unlocks
- **Recommendation**: "You could earn X more coupons by producing Y more Nuclear Pasta" (if close to a sqrt threshold)

---

## Prestige Upgrade Tree

Purchased with coupons. All upgrades are **permanent** (persist through all future prestiges). Organized into three paths.

### Production Path — Make More Stuff

| Upgrade | Cost | Effect | Prereq |
|---------|------|--------|--------|
| Efficiency I | 3 | All production ×1.5 | — |
| Efficiency II | 10 | All production ×2 | Efficiency I |
| Efficiency III | 30 | All production ×3 | Efficiency II |
| Efficiency IV | 80 | All production ×5 | Efficiency III |
| Coupon Amplifier | 50 | Coupon passive bonus: +2% → +3% per coupon | Efficiency II |

Efficiency upgrades **stack multiplicatively**: I + II + III + IV = 1.5 × 2 × 3 × 5 = **45× production**.

### Comfort Path — Smoother Restarts

| Upgrade | Cost | Effect | Prereq |
|---------|------|--------|--------|
| Quick Start | 2 | Start each prestige with 500 Iron Ore | — |
| Automation Memory I | 8 | Keep Iron Ore + Plates automation | Quick Start |
| Automation Memory II | 25 | Keep all tier 1–4 automation | Auto Memory I |
| Automation Memory III | 60 | Keep ALL automation | Auto Memory II |
| Blueprint Cache | 5 | Tier unlock costs halved (20 → 10) | — |
| Lab Readiness | 15 | Both labs start unlocked + assigned to their pre-prestige research | — |
| Boost Persistence | 40 | Keep one random shop boost through prestige | Auto Memory I |
| Boost Vault | 100 | Keep ALL shop boosts through prestige | Boost Persistence |

### Speed Path — Go Faster

| Upgrade | Cost | Effect | Prereq |
|---------|------|--------|--------|
| Speed Assembly I | 5 | Base run times −20% | — |
| Speed Assembly II | 20 | Base run times −20% (stacks: total −36%) | Speed Assembly I |
| Producer Discount | 15 | Producer cost multiplier: 1.15 → 1.13 | — |
| Bulk Producers | 35 | Start with 5 Iron Ore producers (instead of 1) | Producer Discount |
| Research Accelerator | 25 | Research times −25% (permanent, stacks with shop boost) | — |

### Total Coupon Sink

All upgrades combined cost **~450 coupons**. At ~3–10 coupons per early prestige and ~50–100+ per late prestige, this represents dozens of prestige cycles to fully complete — many hours of content.

---

## Prestige Milestones

Automatic rewards based on total prestige count. Never lost once earned.

| Prestiges | Milestone | Effect |
|-----------|-----------|--------|
| 1 | First Evaluation | Prestige tab permanently visible (was hidden before first prestige) |
| 2 | Returning Employee | Start with 200 Iron Ore |
| 3 | Familiar Process | Iron Ore automation free at start |
| 5 | Experienced Builder | Start with Plates already unlocked |
| 8 | Senior Engineer | Plates automation free at start |
| 10 | Production Veteran | Start with Reinforced Plates unlocked |
| 15 | Factory Foreman | All tiers through Modular Frame unlocked + automated at start |
| 20 | Assembly Director | Auto-prestige option unlocked (prestige automatically when optimal) |
| 30 | FICSIT Executive | All tiers through HMF unlocked + automated at start |
| 50 | Master Architect | Start with 10 producers on each unlocked tier |

**Note:** Milestones that auto-unlock tiers also grant the free first producer for each tier (matching normal unlock behavior). Milestones that grant automation do not require the automation cost to be paid.

---

## Balance Targets

### First Run (No Prestige)

- ~2–3 hours active play to reach Nuclear Pasta
- ~10–15 Nuclear Pasta produced before first prestige → **3–4 coupons**
- Player can afford: Quick Start (2) + Efficiency I (3) — one from each path
- Passive bonus: +6–8% production

### Second Run

- Starts with 500 Iron Ore (Quick Start) + 1.5× production (Efficiency I) + ~8% passive
- Reaches Nuclear Pasta in ~60–90 minutes
- Produces ~50–100 Nuclear Pasta → **7–10 coupons**
- Can now afford Speed Assembly I or Blueprint Cache

### Fifth Run

- Multiple efficiency upgrades + speed + automation memory
- Reaches Nuclear Pasta in ~20–30 minutes
- Produces ~500+ Nuclear Pasta → **~22 coupons**
- Upgrade tree ~40% complete

### Twentieth Run

- Most upgrades purchased, milestones auto-unlocking early tiers
- Reaches Nuclear Pasta in ~5 minutes
- Huge Nuclear Pasta stockpile → **100+ coupons per run**
- Approaching upgrade tree completion
- Auto-prestige milestone unlocked

---

## Auto-Prestige (Milestone 20)

Once unlocked, the player can enable auto-prestige with a configurable threshold:

- **Minimum coupons**: only prestige when at least X coupons would be earned
- **Timer-based**: prestige every N minutes if threshold is met
- Works during **offline progress** too (offline time computes production → auto-prestige cycles → coupon accumulation)

Auto-prestige is a major quality-of-life feature that transitions late-game from manual clicking to strategic upgrade planning.

---

## Layer 2 — Corporate Restructuring (Future)

Planned but not implemented in this phase. Architecture should accommodate it.

### High-Level Vision

- **Trigger**: Accumulate a large lifetime coupon threshold (e.g., 1,000+ lifetime coupons)
- **Effect**: Resets coupon balance, all prestige upgrades, prestige count, and milestones. Research levels also reset. Grants **FICSIT Shares** (layer 2 currency).
- **FICSIT Shares** unlock:
  - A deeper upgrade tree with transformative effects (e.g., new resource chain paths, alternative production recipes, global multipliers that dwarf layer 1)
  - Permanent coupon earn rate bonuses (so layer 1 prestige rebuilds faster)
  - New mechanics (challenges, artifacts, alternative resource chains)
- **What persists through layer 2**: FICSIT Shares, layer 2 upgrades, achievements

### Architecture Consideration

The `PrestigeState` type should be designed so layer 2 fields can be added without a breaking migration:

```
PrestigeState = {
  // Layer 1
  couponBalance: BigNum
  lifetimeCoupons: BigNum
  nuclearPastaProducedThisRun: BigNum
  prestigeCount: number
  prestigeUpgrades: Record<PrestigeUpgradeId, boolean>

  // Layer 2 (added later)
  ficsitShares?: BigNum
  lifetimeShares?: BigNum
  shareUpgrades?: Record<ShareUpgradeId, boolean>
  restructureCount?: number
}
```

Optional fields ensure backward compatibility. `SAVE_VERSION` bump handles migration.

---

## Interaction with Existing Systems

### Production Formula (Updated)

```
output = producers
       × productionMultiplier (shop boost: 20x or 1x)
       × researchMultiplier (1 + level × 0.1)
       × continuousMultiplier (if applicable)
       × couponPassiveMultiplier (1 + lifetimeCoupons × 0.02)
       × prestigeEfficiencyMultiplier (product of all Efficiency upgrades)
```

Coupon and prestige multipliers slot into the existing production formula as additional multiplicative factors.

### Run Time Formula (Updated)

```
effectiveRunTime = baseRunTime
                 × speedMilestoneMultiplier (0.5 per 10 producers)
                 × automationBoostMultiplier (shop boost: 0.5x or 1x)
                 × runtimeBoostMultiplier (shop boost: 0.5x or 1x)
                 × speedAssemblyMultiplier (prestige: 0.8 per level, multiplicative)
```

### Offline Progress

- Prestige multipliers apply to offline production calculations
- Auto-prestige (if unlocked and enabled) processes during offline progress:
  - Simulate production → check auto-prestige threshold → execute prestige → continue with new bonuses
  - Cap at reasonable cycle count to prevent computation explosion

### Plausibility Checks

- Server must account for prestige multipliers when validating production rates
- `maxProductionRate` calculation updated to include coupon passive bonus + prestige upgrades
- Prestige action itself needs server validation (verify Nuclear Pasta count, compute coupons server-side)

### Serialization

- Bump `SAVE_VERSION` (5 → 6)
- Add `prestige` field to `SerializedGameState`
- Migration: existing saves get default `PrestigeState` (0 coupons, no upgrades, count 0)
- `nuclearPastaProducedThisRun` must be tracked as a new field on `ResourceState` or as a separate accumulator

---

## UI Design

### Prestige Tab

A new tab in the main navigation (alongside Resources, Research, Shop). Hidden until first prestige OR until Nuclear Pasta is unlocked (whichever comes first).

**Tab contents:**

1. **Status bar** — Lifetime coupons, current balance, passive bonus percentage
2. **Prestige button** — Large, prominent. Disabled until ≥1 Nuclear Pasta produced. Shows coupon preview on hover.
3. **Upgrade tree** — Visual grid/tree with three paths (Production, Comfort, Speed). Purchased upgrades highlighted. Affordable upgrades glowing. Locked upgrades grayed with prereq shown.
4. **Milestones tracker** — Horizontal progress bar showing prestige count vs. next milestone. List of all milestones with earned/unearned status.
5. **Statistics** — Total prestiges, fastest run, most coupons in single prestige, lifetime Nuclear Pasta.

### Prestige Confirmation Modal

Triggered by clicking the prestige button. Contains:

- Coupon calculation breakdown
- What you keep / what you lose (clear two-column layout)
- "Prestige Now" button (primary action)
- "Keep Playing" button (dismiss)
- Optional: "Don't show again" checkbox (for experienced players with auto-prestige)

### Post-Prestige Animation

Brief celebration animation when prestige completes:

- Coupon counter ticks up
- Factory "dismantle" visual effect
- Quick transition to fresh state
- Toast notification: "FICSIT Evaluation complete! +X Coupons earned."

---

## API Changes

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/game/prestige` | POST | Execute prestige (validate, compute coupons, reset state) |
| `/api/game/buy-prestige-upgrade` | POST | Purchase a prestige upgrade with coupons |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /api/game` | Response includes prestige state; offline progress accounts for prestige multipliers |
| `POST /api/game/sync` | Plausibility check accounts for prestige multipliers |
| `POST /api/game/save` | Saves prestige state alongside game state |

### Prestige Endpoint Logic

```
POST /api/game/prestige
Body: { serverVersion }

1. Load game state from Redis
2. Verify serverVersion (409 on mismatch)
3. Compute nuclearPastaProducedThisRun
4. Calculate couponsEarned = floor(sqrt(nuclearPastaProducedThisRun))
5. Verify couponsEarned >= 1 (400 if not)
6. Apply prestige:
   a. Add couponsEarned to couponBalance and lifetimeCoupons
   b. Increment prestigeCount
   c. Reset resources to initial state (apply milestones for auto-unlocks)
   d. Reset producers (apply milestones for starting producers)
   e. Reset automation (apply milestones + Automation Memory upgrades)
   f. Reset shop boosts (apply Boost Persistence/Vault upgrades)
   g. Keep research levels and lab unlocks
   h. Reset nuclearPastaProducedThisRun to 0
   i. Increment serverVersion
7. Save to Redis
8. Return new state + prestige summary
```

---

## Data Model

### New Types

```typescript
type PrestigeUpgradeId =
  | 'efficiency-1' | 'efficiency-2' | 'efficiency-3' | 'efficiency-4'
  | 'coupon-amplifier'
  | 'quick-start'
  | 'automation-memory-1' | 'automation-memory-2' | 'automation-memory-3'
  | 'blueprint-cache'
  | 'lab-readiness'
  | 'boost-persistence' | 'boost-vault'
  | 'speed-assembly-1' | 'speed-assembly-2'
  | 'producer-discount'
  | 'bulk-producers'
  | 'research-accelerator'

type PrestigeState = {
  couponBalance: BigNum
  lifetimeCoupons: BigNum
  nuclearPastaProducedThisRun: BigNum
  prestigeCount: number
  upgrades: Record<PrestigeUpgradeId, boolean>
}

// Extended GameState
type GameState = {
  resources: Record<ResourceId, ResourceState>
  shopBoosts: ShopBoosts
  labs: Record<LabId, LabState>
  research: Record<ResearchId, number>
  lastSavedAt: number
  prestige: PrestigeState  // NEW
}
```

### Serialized Format

```typescript
type SerializedPrestigeState = {
  cb: SerializedBigNum        // couponBalance
  lc: SerializedBigNum        // lifetimeCoupons
  np: SerializedBigNum        // nuclearPastaProducedThisRun
  pc: number                  // prestigeCount
  up: Record<string, boolean> // upgrades
}
```

### Config

```typescript
type PrestigeUpgradeConfig = {
  id: PrestigeUpgradeId
  name: string
  description: string
  cost: number
  path: 'production' | 'comfort' | 'speed'
  prereq: PrestigeUpgradeId | null
}
```

---

## Implementation Order

Phase 1 — **Core prestige loop** (MVP):

1. Add `PrestigeState` to `GameState` and serialization (bump SAVE_VERSION)
2. Track `nuclearPastaProducedThisRun` in production logic
3. Implement coupon calculation formula
4. Implement prestige reset logic (reset state, keep research + coupons)
5. Apply coupon passive bonus to production formula
6. Add `POST /api/game/prestige` endpoint
7. Build prestige confirmation modal
8. Build minimal prestige tab (balance display + prestige button)

Phase 2 — **Upgrade tree**:

9. Define upgrade configs and costs
10. Implement upgrade purchase logic + `POST /api/game/buy-prestige-upgrade`
11. Apply upgrade effects to production, run time, and reset logic
12. Build upgrade tree UI with paths and prereqs

Phase 3 — **Milestones + polish**:

13. Implement milestone system (prestige count → automatic bonuses)
14. Apply milestones to reset logic (auto-unlock tiers, free automation, starting resources)
15. Build milestone tracker UI
16. Add prestige statistics tracking
17. Post-prestige animation and celebration
18. Update plausibility checks for prestige multipliers
19. Update offline progress for prestige multipliers

Phase 4 — **Auto-prestige** (after milestone 20 exists):

20. Implement auto-prestige toggle and threshold config
21. Integrate auto-prestige into offline progress computation
22. Auto-prestige UI controls

Phase 5 — **Layer 2 prep** (architecture only):

23. Add optional layer 2 fields to `PrestigeState`
24. Design layer 2 upgrade tree and trigger conditions
25. Implementation deferred to a future design doc
