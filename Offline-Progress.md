# Feature Recommendation: Offline Progress

## Summary

When a player returns to ProdFactory after closing the tab, their automated resources should have continued producing in their absence — up to a maximum of 8 hours. On return, a modal summarizes what the factory produced while they were away.

This is the single highest-impact mechanic missing from the game. Idle games live or die on the "return loop": the dopamine hit of coming back to find your factory has been busy. Without it, closing the tab feels wasteful and players churn faster.

---

## Player Experience

1. Player closes the tab with Iron Ore, Plates, and Reinforced Plates all automated.
2. Player returns 6 hours later.
3. On load, before the main game UI renders, a modal appears:

   ```
   ┌─────────────────────────────────────────┐
   │  Your factory kept running!             │
   │  You were away for 6h 14m              │
   │                                         │
   │  ⚙  Iron Ore          +4.20 billion    │
   │  ⚙  Plates            +312 million     │
   │  ⚙  Reinforced Plate  +18.5 million    │
   │                                         │
   │              [ Collect ]                │
   └─────────────────────────────────────────┘
   ```

4. Player clicks Collect. Modal closes, game loads with the updated amounts.
5. Resources not automated (or paused) show nothing in the modal.

---

## Why It Fits

- **Server already has everything needed.** `lastSavedAt` is persisted on every save. The plausibility checker already computes per-second production rates for every automated resource. Offline gain is just `rate × elapsed_seconds`.
- **No client-side trust required.** Calculation happens entirely on the server during the `GET /api/game` load, so it inherits the existing plausibility infrastructure.
- **Consistent with the Satisfactory theme.** Your factory doesn't stop when you step away from the screen — that's the whole point of automation.

---

## Technical Approach

### Server: `GET /api/game`

Currently this route just loads and returns the saved state. Extend it to:

1. Compute `elapsedSeconds = (Date.now() - state.lastSavedAt) / 1000`
2. Clamp to `maxOfflineSeconds = 8 * 3600` (8 hours)
3. For each resource that is `isAutomated && !isPaused`:
   - Use the existing per-second rate logic (same as plausibility checker) to compute `offlineGain = rate × elapsedSeconds`
   - Add gain to `resource.amount`
   - Do **not** touch `runStartedAt` — the client will re-sync its run timer on mount anyway
4. If any gains were applied, attach a `offlineSummary` field to the response:
   ```typescript
   type OfflineSummary = {
     elapsedSeconds: number;
     gains: { resourceId: ResourceId; amount: BigNum }[];
   };
   ```
5. Save the updated state before returning (so the next load doesn't double-apply).

### Shared Logic

Reuse the rate calculation already in `plausibility.ts` (or wherever per-second rates are computed). Extract it into a shared helper like `computeProductionRate({ resource, state, boosts })` if it isn't already a standalone function.

### Client: Offline Summary Modal

- `GET /api/game` response is already consumed by the initial load hook.
- If `offlineSummary` is present and has non-zero gains, store it in a piece of local state before setting the game state.
- Render an `OfflineSummaryModal` component that blocks interaction until dismissed.
- On "Collect", clear the summary state — game is now live.
- The modal should use the same industrial aesthetic as the rest of the game (dark background, amber/orange accents, Satisfactory-style icons).

### Files to Touch

| File | Change |
|------|--------|
| `src/app/api/game/route.ts` | Apply offline gains on load, attach `offlineSummary` to response |
| `src/lib/plausibility.ts` (or equivalent) | Extract rate computation into a reusable helper |
| `src/lib/serialization.ts` | Add `offlineSummary` field to the API response type |
| `src/components/OfflineSummaryModal.tsx` | New component — modal UI |
| `src/context/game-state-context.tsx` | Surface `offlineSummary` from the load response, clear it on collect |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Resource unlocked but not automated | Skip — no offline gain |
| Automated but paused | Skip — player chose to pause |
| Insufficient inputs for higher-tier resource | Server computes gain capped by available input supply at save time. Simpler alternative: only apply offline gains to tier-1 (Iron Ore) exactly, and let higher tiers catch up on the next sync. |
| Player was away < 30 seconds | Don't show the modal — too short to be meaningful |
| Player was away > 8 hours | Cap at 8 hours, note the cap in the modal: "Capped at 8h — upgrade your producers!" |
| First ever load (no `lastSavedAt`) | Skip offline calculation |

---

## Scope & Effort

This feature is self-contained and doesn't require changes to the BigNumber system, action queue, or any existing game mechanics. The plausibility rate logic is already written and tested. The main new work is:

- Server-side offline calculation (~40 lines)
- `OfflineSummaryModal` component (~80 lines)
- Wiring the summary through the load response (~20 lines)

The input-consumption edge case (higher-tier resources consuming lower-tier ones offline) is the trickiest part. The simplest correct approach: **only grant offline gains to fully independent tiers** — i.e., a resource only accrues offline if its input resource also accrued enough to cover the runs. This can be solved by processing the resource chain in order (tier 0 → tier N) and tracking how much each tier produced offline before computing the next tier's gain.
