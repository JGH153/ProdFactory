This plan is already implemented and only serve as documentation for the current server-side validation system.

# Fix: UI Jumping During Rapid Clicks and Save/Sync Overlap

## Problem

Rapidly clicking buy-producer (e.g. upgrading iron ore) causes the producer count and resource amounts to visibly jump backward and forward. The same flickering occurs when a click coincides with an in-flight auto-save or auto-sync request.

---

## Root Cause

There are two separate causes working together.

### Cause 1: Action response reconciliation overwrites optimistic state

Every server-validated action (buy-producer, buy-automation, unlock, etc.) follows this flow:

1. **Click** — client applies the action optimistically via `setState` using the same pure function the server uses (`buyProducer`, etc.)
2. **Enqueue** — the action is pushed onto a serial queue in `use-server-sync.ts`
3. **Send** — the queue sends the action to the server with the current `serverVersion`
4. **Receive** — on success, `reconcileState(result.state, false)` replaces **all** resource fields (except `runStartedAt`) with the server's returned state

The problem is at step 4. When the user clicks 3 times rapidly:

| Time                   | Client state (producers) | Server state (producers) | What the user sees    |
| ---------------------- | ------------------------ | ------------------------ | --------------------- |
| Click 1                | 6 (optimistic)           | 5 (not processed yet)    | 6                     |
| Click 2                | 7 (optimistic)           | 5                        | 7                     |
| Click 3                | 8 (optimistic)           | 5                        | 8                     |
| Server processes buy 1 | **6** (reconciled!)      | 6                        | **6 — JUMP backward** |
| Server processes buy 2 | **7** (reconciled!)      | 7                        | **7 — still behind**  |
| Server processes buy 3 | 8 (reconciled)           | 8                        | 8 — finally correct   |

The user sees: 8 → 6 → 7 → 8. This is the flickering.

**Where in the code:**

- Optimistic update: [game-state-context.tsx:152](src/game/game-state-context.tsx#L152) — `setState((current) => buyProducer(current, resourceId))`
- Reconciliation call: [use-server-sync.ts:114](src/game/use-server-sync.ts#L114) — `reconcileState(result.state, false)`
- Reconciliation logic: [game-state-context.tsx:73-81](src/game/game-state-context.tsx#L73-L81) — spreads server state over client state, preserving only `runStartedAt`

Additionally, runs complete client-side via `requestAnimationFrame` ([game-state-context.tsx:97-140](src/game/game-state-context.tsx#L97-L140)). If a run completes between sending an action and receiving the response, reconciliation "undoes" the awarded resources because the server doesn't know about client-side run completions.

### Cause 2: Save/sync and action requests race

Auto-save ([use-server-sync.ts:172-200](src/game/use-server-sync.ts#L172-L200)) and auto-sync ([use-server-sync.ts:204-234](src/game/use-server-sync.ts#L204-L234)) skip when the queue has items or is processing. But there's a race window:

1. Save interval fires — queue is empty, not processing — save request sent with `serverVersion=N`
2. User clicks buy-producer before save response arrives — action enqueued, `processQueue` starts, action sent with `serverVersion=N`
3. Both requests are now in-flight with the same version

If the server processes the save first, it increments version to N+1. The action then arrives with version N, gets a **409 conflict**. The conflict handler reconciles to the server's state (which doesn't include the optimistic buy), causing another visible jump.

**Where in the code:**

- Save guard check: [use-server-sync.ts:174-180](src/game/use-server-sync.ts#L174-L180)
- Save conflict handler: [use-server-sync.ts:190-194](src/game/use-server-sync.ts#L190-L194)

---

## Fix 1: Skip reconciliation on successful action responses

### What to change

In `processQueue` in [use-server-sync.ts](src/game/use-server-sync.ts), remove the `reconcileState` call after a successful action response. Only update `serverVersionRef.current`.

**Current behavior (lines 107-115):**

```typescript
const result = await executeAction({
  endpoint: item.endpoint,
  resourceId: item.resourceId,
  serverVersion: serverVersionRef.current,
});
serverVersionRef.current = result.serverVersion;
reconcileState(result.state, false); // ← causes the flicker
queueRef.current.shift();
```

**New behavior:**

```typescript
const result = await executeAction({
  endpoint: item.endpoint,
  resourceId: item.resourceId,
  serverVersion: serverVersionRef.current,
});
serverVersionRef.current = result.serverVersion;
// Skip reconcileState — client optimistic state is already correct
queueRef.current.shift();
```

Also apply the same change to the conflict retry success path at line 128:

```typescript
// Current (line 127-128):
serverVersionRef.current = retryResult.serverVersion;
reconcileState(retryResult.state, false); // ← also remove this

// New:
serverVersionRef.current = retryResult.serverVersion;
// Skip reconcileState — retry succeeded, client state is correct
```

### Why this is safe

- The client and server use the **exact same pure functions** from [logic.ts](src/game/logic.ts) (`buyProducer`, `buyAutomation`, `unlockResource`, `togglePause`, `buyMaxProducers`). Given the same starting state, both sides produce identical results.
- The queue processes actions **serially**, and each action uses the correct `serverVersion`. Under normal operation (no conflicts), every action will succeed with matching versions, guaranteeing the server applies the same transformation the client already applied.
- **Conflicts (409) still reconcile.** The existing conflict handler at [use-server-sync.ts:117-134](src/game/use-server-sync.ts#L117-L134) keeps its `reconcileState` call on the initial conflict. This is correct — conflicts mean the server has genuinely divergent state (e.g. from another tab), so reconciliation is needed.
- **Auto-save pushes the client's full state to the server every 5 seconds**, so even if minor drift accumulates (e.g. from BigNum rounding), it self-corrects quickly.
- **Auto-sync validates plausibility every 15 seconds**, catching any significant divergence.

### What this fixes

After this change, rapid clicking produces:

| Time                   | Client state (producers) | What the user sees |
| ---------------------- | ------------------------ | ------------------ |
| Click 1                | 6                        | 6                  |
| Click 2                | 7                        | 7                  |
| Click 3                | 8                        | 8                  |
| Server processes buy 1 | 8 (no reconcile)         | 8 — stable         |
| Server processes buy 2 | 8 (no reconcile)         | 8 — stable         |
| Server processes buy 3 | 8 (no reconcile)         | 8 — stable         |

No flicker.

---

## Fix 2: Guard against save/sync and action queue races

### What to change

Add an in-flight promise ref to prevent the action queue from running while a save/sync request is in-flight, and vice versa prevent save/sync responses from updating `serverVersionRef` if actions were enqueued during the request.

**File:** [use-server-sync.ts](src/game/use-server-sync.ts)

#### Step A: Add a ref to track in-flight save/sync

```typescript
const inFlightSaveRef = useRef<Promise<unknown> | null>(null);
```

#### Step B: Wrap auto-save dispatch with the ref

When dispatching a save, store the promise. In the `.then()` handler, only update `serverVersionRef` if the queue is still empty (no actions were enqueued while the save was in-flight). Always clear the ref in `.finally()`.

```typescript
const savePromise = executeSave({
  state: serialized,
  serverVersion: serverVersionRef.current,
})
  .then((result) => {
    if (queueRef.current.length === 0 && !processingRef.current) {
      serverVersionRef.current = result.serverVersion;
    }
  })
  .catch((error) => {
    if (error instanceof ConflictError) {
      if (queueRef.current.length === 0 && !processingRef.current) {
        serverVersionRef.current = error.serverVersion;
        reconcileState(error.state, false);
      }
    }
  })
  .finally(() => {
    inFlightSaveRef.current = null;
  });

inFlightSaveRef.current = savePromise;
```

Apply the same pattern to the auto-sync interval.

#### Step C: Await in-flight save at the start of `processQueue`

```typescript
const processQueue = useCallback(async () => {
  if (processingRef.current || !isReadyRef.current) {
    return;
  }
  // Wait for any in-flight save/sync to finish so we have the correct serverVersion
  if (inFlightSaveRef.current) {
    await inFlightSaveRef.current;
  }
  processingRef.current = true;
  // ... rest of queue processing
}, [executeAction]);
```

### Why this is safe

- If a save is in-flight when the user clicks, `processQueue` waits for the save to finish. The save response updates `serverVersionRef` (if no actions were enqueued — but they were, so it skips the update). Then `processQueue` proceeds with the pre-save version. The action may get a 409 if the save incremented the version on the server, but the existing conflict handler retries once — which succeeds.
- More commonly: the save finishes, the queue sees the save didn't update the version (because actions are queued), and proceeds with the original version. If the action hits a 409 because the save incremented the server version, the conflict handler reconciles and retries. With Fix 1 in place, the retry success doesn't reconcile, so no flicker.
- The await adds at most one network round-trip of delay to the first queued action. Subsequent actions in the queue are unaffected since save/sync intervals won't fire while `processingRef.current` is true.

---

## Edge Cases

### Multiple rapid clicks, no conflicts

Fix 1 eliminates all flicker. Each action success only updates the version counter. The client keeps its optimistic state throughout.

### Click during save in-flight

Fix 2 makes `processQueue` await the save. The action then uses the correct version. Even if it gets a 409 (save incremented the version), the conflict retry succeeds and Fix 1 prevents the retry from overwriting optimistic state.

### Multiple tabs open

Tab A buys a producer → server version increments. Tab B sends an action with the old version → 409. Tab B reconciles to server state (which includes Tab A's purchase), retries, succeeds. Reconciliation on conflict is intentional and correct here — the states genuinely diverged.

### Run completing during action flight

With Fix 1, the client keeps its state (including the completed run's resources). Without Fix 1, reconciliation would "undo" the run's resources until the next save pushes the correct state to the server.

### Queue clear on double-failure

If a conflict retry also fails (extremely rare), the queue is cleared. The client state may diverge from the server. The auto-save interval (5s) pushes the client state to the server, self-correcting within seconds.

---

## Files to Modify

Only one file needs changes:

| File                                                       | Changes                                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/game/use-server-sync.ts](src/game/use-server-sync.ts) | Remove `reconcileState` from success paths in `processQueue` (lines ~114, ~128). Add `inFlightSaveRef`, wrap save/sync dispatches, await in `processQueue`. |

No changes needed to:

- [src/game/game-state-context.tsx](src/game/game-state-context.tsx) — `reconcileState` itself is unchanged
- [src/lib/api-client.ts](src/lib/api-client.ts) — API layer unchanged
- Server-side routes — no backend changes needed

---

## Verification

1. **Rapid clicking test**: Click buy-producer on iron ore as fast as possible. Producer count and resource amount should increase smoothly with no backward jumps.
2. **Click-during-save test**: Watch the Network tab. Click buy-producer right as a `/api/game/save` request fires. No 409 should appear. If one does, the UI should not visibly flicker.
3. **Persistence test**: After rapid clicking, wait 5+ seconds for auto-save, then refresh the page. The correct producer count and resource amount should load.
4. **Multi-tab test**: Open two tabs. Buy a producer in tab A. Verify tab B's next action handles the version conflict gracefully (brief reconciliation is acceptable).
5. **Auto-sync test**: Let the game run with automation. Verify the 15-second plausibility sync still works (no warnings in the console unless actually cheating).
6. **Run `pnpm validate`** to confirm no type errors, lint issues, or dead code.
