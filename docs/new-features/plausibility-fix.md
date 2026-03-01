# Fix: False-positive plausibility warnings during rapid upgrades

## Context

When a player rapidly buys producers, unlocks tiers, and buys automation, the plausibility check triggers false-positive corrections (10-11% excess). This happens because of a state divergence between the client's optimistic state and the server's snapshot baseline.

## Root Cause

The divergence arises from three interacting behaviors:

1. **Client optimistic updates use the client's live state.** When the user clicks "Buy Max Producers," the client calls `buyMaxProducers(currentState)` where `currentState` includes production accumulated since the last save. (game-state-context.tsx:271)

2. **Server mutations use the stored state.** The server applies the same `buyMaxProducers` against its stored state from the last save — which has LESS of the resource (no production since save). (api-helpers.ts:362-363)

3. **Happy-path mutations don't reconcile.** In `processQueue`, on success, only `serverVersionRef` is updated — `reconcileState` is NOT called. (use-server-sync.ts:124) The client retains its higher resource amounts.

This creates "phantom" production: resources that accumulated between the last save and the mutation, which exist in the client's state but not in the server's stored state.

**Example timeline:**
- T=0: Save fires. Client & server agree: iron=10B. Snapshot: iron=10B, T=T0.
- T=0 to T=1: Client produces iron via game tick. Client: iron=11B.
- T=1: Client clicks buy-max-producers. Client deducts cost from 11B. Server deducts same cost from 10B (stored). Client retains 1B more iron than server (the "phantom").
- T=2.7: Save fires. `actualGain = claimed - snapshot = (11B - cost + production) - 10B`. The phantom 1B pushes gain ~10% above the plausibility max, triggering a false correction.

**Why 10%?** The plausibility max uses `Math.max(snapshot.producers, claimed.producers)` for the full elapsed window, which IS generous enough to cover actual production (~93% of max due to continuous mode). But the phantom adds ~5-18% on top depending on how long between the save and the mutation, which can push total above the 10% tolerance.

## Fix

### 1. Update `patchSnapshotMetadata` to include resource amounts and producers

**File:** `src/lib/server/api-helpers.ts` (lines 298-318)

Currently `patchSnapshotMetadata` only patches `research` and `labs` into the snapshot. It should ALSO patch `resources` (amounts + producers). This updates the snapshot baseline to reflect the server's post-mutation resource amounts (which are lower due to spending), eliminating the divergence.

The **timestamp should NOT be updated** — keeping the original save timestamp means the plausibility check still validates the full window (including the phantom period), but now using a lower baseline. Since `maxProduction` uses the new (higher) producer count for the full window, it's always >= phantom + post-mutation production.

```typescript
// Before:
await setSyncSnapshot({
    sessionId,
    snapshot: {
        ...existing,
        ...(fresh.research && { research: fresh.research }),
        ...(fresh.labs && { labs: fresh.labs }),
    },
});

// After:
await setSyncSnapshot({
    sessionId,
    snapshot: {
        ...existing,
        resources: fresh.resources,
        ...(fresh.research && { research: fresh.research }),
        ...(fresh.labs && { labs: fresh.labs }),
    },
});
```

**Why this works:** After updating snapshot resources to post-mutation amounts:
- `actualGain = claimed - snapshot = phantom + prod_since_mutation`
- `maxProduction` uses new producers for full elapsed window
- `phantom (old_rate * elapsed_pre) + prod_since (new_rate * elapsed_post) < new_rate * total_elapsed = maxProduction`
- Always passes because `old_rate < new_rate` (we bought producers)

### 2. Increase tolerance from 10% to 15%

**File:** `src/lib/server/plausibility.ts` (line 36)

Change `PLAUSIBILITY_TOLERANCE` from `1.1` to `1.15`. This provides additional headroom for edge cases (network timing jitter, floating-point precision in BigNum operations, rapid sequential mutations).

```typescript
const PLAUSIBILITY_TOLERANCE = 1.15;
```

## Verification

1. Run existing plausibility tests: `pnpm test src/lib/server/plausibility.test.ts`
2. Run full validation: `pnpm validate`
3. Manual test: rapidly buy producers, unlock tiers, and buy automation — verify no plausibility warnings in server logs
