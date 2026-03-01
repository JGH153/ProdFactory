This plan is already implemented and only serve as documentation for the current server-side validation system.

# Prestige System Design — FICSIT Evaluation

## Overview

When a player's factory reaches Nuclear Pasta production, FICSIT Corp evaluates the operation and awards **Coupons** — a permanent prestige currency. The player then **dismantles the factory** and rebuilds from Iron Ore, keeping their Coupons, prestige upgrades, and research levels. Each cycle is faster than the last thanks to coupon bonuses and upgrades.

**Design pillars:**

1. **Clear goal** — reach Nuclear Pasta, stockpile, prestige.
2. **Always feel stronger** — every prestige makes the next run noticeably faster.
3. **Respect player time** — research levels carry over (the slowest grind), milestones compress early game.

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

Every coupon **ever earned** (lifetime total, not current balance) gives **+2% all production**.

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
- Run timers → cleared
- Lab assignments → cleared (labs stay unlocked per research retention)

### Persists Through Prestige

- **Research levels** — all 8 research types keep their current level (0–10)
- **Lab unlock status** — if labs were unlocked, they stay unlocked
- **All shop boosts** — Dont reset shop boosts 
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

## Prestige Milestones

Automatic rewards based on total prestige count. Never lost once earned.

| Prestiges | Milestone | Effect |
|-----------|-----------|--------|
| 1 | First Evaluation | Prestige tab permanently visible (was hidden before first prestige) |
| 2 | Returning Employee | Start with 200 Iron Ore |
| 3 | Familiar Process | Iron Ore automation free at start |
| 5 | Experienced Builder | Start with Plates already unlocked |

---

## Interaction with Existing Systems


### Offline Progress

- Prestige multipliers apply to offline production calculations

### Plausibility Checks

- Server must account for prestige multipliers when validating production rates
- `maxProductionRate` calculation updated to include coupon passive bonus
- Prestige action itself needs server validation (verify Nuclear Pasta count, compute coupons server-side)

### Serialization

- Bump `SAVE_VERSION` (5 → 6)
- Add `prestige` field to `SerializedGameState`
- Migration: existing saves get default `PrestigeState` (0 coupons)
- `nuclearPastaProducedThisRun` must be tracked as a new field on `ResourceState` or as a separate accumulator

---

## UI Design

### Prestige Tab

A new tab in the main navigation (alongside Resources, Research, Shop). Locked until first prestige OR until Nuclear Pasta is unlocked (whichever comes first).

**Tab contents:**

1. **Status bar** — Lifetime coupons, current balance, passive bonus percentage
2. **Prestige button** — Large, prominent. Disabled until ≥1 Nuclear Pasta produced. Shows coupon preview on hover.
3. **Milestones tracker** — Horizontal progress bar showing prestige count vs. next milestone. List of all milestones with earned/unearned status.
4. **Statistics** — Total prestiges, fastest run, most coupons in single prestige, lifetime Nuclear Pasta.

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

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /api/game` | Response includes prestige state; offline progress accounts for prestige multipliers |
| `POST /api/game/sync` | Plausibility check accounts for prestige multipliers |
| `POST /api/game/save` | Saves prestige state alongside game state |

