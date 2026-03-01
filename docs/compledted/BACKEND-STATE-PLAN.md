This plan is already implemented and only serve as documentation for the current server-side validation system.

# Server-Side Validation for ProdFactory

## 1. Overview

### Problem

All game state currently lives in `localStorage` and all logic runs in the browser. A player can:

- Edit `localStorage` directly to set arbitrary resource amounts
- Use browser devtools to call game functions with fabricated state
- Manipulate `Date.now()` to instantly complete runs
- Use automation tools to click faster than humanly possible

With leaderboards planned, this is a competitive integrity problem — not just a single-player concern.

### Goals

1. **Prevent meaningful cheating** — all purchases and upgrades validated server-side
2. **Detect production cheating** — periodic plausibility checks catch impossible resource gains
3. **Preserve game feel** — client still runs the game loop; no added latency on clicks or timer completion
4. **Minimize server cost** — no game loop on the server; just validation and storage
5. **Support future features** — session system that can later support accounts, leaderboards, and database migration

### Approach Summary

The client remains the primary game loop driver. The server acts as a **gatekeeper for state-changing actions** (purchases, unlocks, automation) and a **periodic auditor for production claims**. Game state is stored in Redis (Upstash) instead of localStorage.

```
Client (game loop, UI, timers)
   │
   ├── Upgrades/Purchases ──► POST /api/game/* ──► Server validates ──► Redis
   │                                                    │
   │                                                    ▼
   │◄────────────────────────── Returns new authoritative state
   │
   ├── Periodic sync ──────► POST /api/game/sync ──► Plausibility check
   │                                                    │
   │                                                    ▼
   │◄────────────────────────── Returns corrected state (if needed)
   │
   └── Game loop (RAF tick) runs entirely client-side
```

---

## 2. How Similar Games Handle This

### Adventure Capitalist — Client-trusting (weak)

Adventure Capitalist offloads nearly all computation to the client. The server acts as a backup store for cross-device sync. Cheating is trivial — the top leaderboard spots are dominated by cheaters. The developer's rationale was cost: running timers server-side for hundreds of thousands of users is expensive. This is **not a good model** for a game with competitive leaderboards.

### Firestone Idle RPG — Server-authoritative (strong)

Firestone started as a client-side game and was reworked to be 99% server-authoritative after cheating became rampant. The only client-side calculation is battle progress (too computationally expensive for the server). They ban ~1% of new players daily for cheating. This is the **closest model** to what ProdFactory should aim for, adapted to our "no server game loop" constraint.

### Melvor Idle — No protection (single-player)

Melvor Idle has zero anti-cheat. The developer explicitly allows cheating since it's single-player. Not applicable since ProdFactory plans competitive features.

### ProdFactory's Position

ProdFactory sits between Adventure Capitalist and Firestone: **server-validated actions** (like Firestone) but **client-driven production** (like Adventure Capitalist), with **plausibility checks** to bridge the gap. This balances cost, UX, and integrity.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     BROWSER                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │           GameStateProvider                  │    │
│  │                                              │    │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  │    │
│  │  │ Game Loop │  │  Upgrade  │  │   Sync   │  │    │
│  │  │ (RAF tick)│  │  Actions  │  │  Timer   │  │    │
│  │  │ client-   │  │ server-   │  │  (15s)   │  │    │
│  │  │ only      │  │ validated │  │          │  │    │
│  │  └──────────┘  └─────┬─────┘  └────┬─────┘  │    │
│  │                      │              │         │    │
│  └──────────────────────┼──────────────┼─────────┘    │
│                         │              │              │
└─────────────────────────┼──────────────┼──────────────┘
                          │              │
                   ───────┼──────────────┼─────── HTTP
                          │              │
┌─────────────────────────┼──────────────┼──────────────┐
│                    VERCEL SERVERLESS                    │
│                         │              │               │
│  ┌──────────────────────▼──────────────▼────────────┐  │
│  │              Next.js API Routes                   │  │
│  │                                                   │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────┐  │  │
│  │  │  Validate   │  │ Plausibility │  │  Session  │  │  │
│  │  │  Upgrades   │  │   Check      │  │  Mgmt    │  │  │
│  │  └──────┬─────┘  └──────┬───────┘  └────┬─────┘  │  │
│  │         │               │               │         │  │
│  │         └───────────────┼───────────────┘         │  │
│  │                         │                          │  │
│  └─────────────────────────┼──────────────────────────┘  │
│                            │                              │
└────────────────────────────┼──────────────────────────────┘
                             │
                    ─────────┼───────── REST (Upstash SDK)
                             │
                   ┌─────────▼─────────┐
                   │   Upstash Redis   │
                   │                   │
                   │  session:{id}     │
                   │  game:{id}        │
                   │  sync:{id}        │
                   └───────────────────┘
```

---

## 4. Session Management

### Anonymous Sessions

On first visit, the client has no session cookie. The flow:

1. Client detects missing `pf-session` cookie
2. Client calls `POST /api/session`
3. Server generates a UUID v4 session ID
4. Server stores `session:{id}` in Redis with 30-day TTL:
   ```json
   {
     "createdAt": 1707753600000,
     "lastActiveAt": 1707753600000,
     "warnings": 0
   }
   ```
5. Server returns session ID in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie
6. Client proceeds to load game state

### Session Validation

Every API route:
1. Reads `pf-session` cookie from request
2. Checks `session:{id}` exists in Redis
3. If missing/expired → return 401, client creates new session (fresh game)
4. If valid → update `lastActiveAt`, refresh TTL, proceed

### Future Account Linking

When accounts are added later:
- Add `accountId` field to the session object
- Create `POST /api/account/link` endpoint
- Account links to current session's game state
- Multiple sessions can point to one account (cross-device)
- Session cookie remains the auth mechanism; account is just metadata

---

## 5. Game State Storage

### Redis Data Model

**Game state** — `game:{sessionId}` (JSON string, 30-day TTL):
```json
{
  "resources": {
    "iron-ore": {
      "id": "iron-ore",
      "amount": { "m": 1.5, "e": 3 },
      "producers": 5,
      "isUnlocked": true,
      "isAutomated": true,
      "isPaused": false,
      "runStartedAt": 1707753600000
    }
  },
  "lastSavedAt": 1707753600000,
  "version": 4,
  "serverVersion": 42
}
```

This is the same `SerializedGameState` format already used for localStorage, extended with a `serverVersion` counter.

**Sync snapshot** — `sync:{sessionId}` (JSON string, 30-day TTL):
```json
{
  "timestamp": 1707753600000,
  "resources": {
    "iron-ore": { "amount": { "m": 1.5, "e": 3 }, "producers": 5 }
  }
}
```

Stores the resource amounts and producer counts at last sync. Used as the baseline for plausibility checks.

### Why Not Redis Hashes?

The game state is always read/written as a whole unit. JSON strings in a single key are simpler and map directly to the existing serialization format. No benefit to Redis hashes for this access pattern.

### TTL Strategy

- All keys: 30-day TTL, refreshed on every read/write
- If a player doesn't return for 30 days, their state is evicted
- This is acceptable for an anonymous session; when accounts are added, game state should be migrated to a persistent database

---

## 6. API Route Design

All routes are Next.js App Router API routes under `src/app/api/`.

### `POST /api/session`

Create a new anonymous session.

```
Request:  (empty body)
Response: 204 No Content
          Set-Cookie: pf-session={uuid}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
```

### `GET /api/game`

Load game state on page load.

```
Request:  Cookie: pf-session={id}
Response: 200 OK
{
  "state": SerializedGameState,
  "serverVersion": number
}

Error: 401 if no/invalid session
Error: 404 if no saved game (client should initialize fresh game)
```

### `POST /api/game/save`

Periodic state save (replaces localStorage auto-save). Only accepts state if `serverVersion` matches (optimistic concurrency).

```
Request:
{
  "state": SerializedGameState,
  "serverVersion": number
}

Response: 200 OK
{
  "serverVersion": number  // incremented
}

Error: 409 Conflict if serverVersion mismatch (stale client)
```

### `POST /api/game/sync`

Plausibility check + state save. Called every 15 seconds.

```
Request:
{
  "state": SerializedGameState,
  "serverVersion": number
}

Response: 200 OK
{
  "state": SerializedGameState | null,  // null if accepted as-is, corrected state if adjusted
  "serverVersion": number,
  "warning": string | null              // non-null if plausibility check failed
}
```

### `POST /api/game/buy-producer`

Server-validated producer purchase.

```
Request:
{
  "resourceId": ResourceId,
  "serverVersion": number
}

Response: 200 OK
{
  "state": SerializedGameState,
  "serverVersion": number
}

Error: 400 if cannot afford / resource locked
Error: 409 if serverVersion mismatch
```

### `POST /api/game/buy-max-producers`

Server-validated bulk producer purchase.

```
Request:
{
  "resourceId": ResourceId,
  "serverVersion": number
}

Response: 200 OK
{
  "state": SerializedGameState,
  "serverVersion": number
}
```

### `POST /api/game/buy-automation`

Server-validated automation purchase.

```
Request:
{
  "resourceId": ResourceId,
  "serverVersion": number
}

Response: 200 OK
{
  "state": SerializedGameState,
  "serverVersion": number
}

Error: 400 if cannot afford / already automated / resource locked
```

### `POST /api/game/unlock`

Server-validated tier unlock.

```
Request:
{
  "resourceId": ResourceId,
  "serverVersion": number
}

Response: 200 OK
{
  "state": SerializedGameState,
  "serverVersion": number
}

Error: 400 if cannot afford / already unlocked
```

### `POST /api/game/toggle-pause`

Toggle automation pause. Lightweight, but still server-validated to keep state consistent.

```
Request:
{
  "resourceId": ResourceId,
  "serverVersion": number
}

Response: 200 OK
{
  "state": SerializedGameState,
  "serverVersion": number
}
```

### `POST /api/game/reset`

Reset game to initial state.

```
Request:
{
  "serverVersion": number
}

Response: 200 OK
{
  "state": SerializedGameState,
  "serverVersion": number
}
```

---

## 7. Server-Validated Actions

### Flow for All Upgrade Actions

Every upgrade (buy producer, buy automation, unlock, toggle pause) follows the same pattern:

```
1. Client clicks button
2. Client applies action OPTIMISTICALLY to local state (instant UI feedback)
3. Client sends POST to server with resourceId + serverVersion
4. Server loads game state from Redis
5. Server checks serverVersion matches (reject if stale)
6. Server runs the SAME pure function from shared logic:
   - buyProducer(state, resourceId)
   - buyAutomation(state, resourceId)
   - unlockResource(state, resourceId)
   - etc.
7. If function returns unchanged state → action was invalid → return 400
8. If function returns new state → save to Redis, increment serverVersion → return new state
9. Client replaces local state with server-returned state
```

### Why Optimistic Updates?

Idle games need to feel snappy. If the client waited for the server response before updating the UI, every button click would have 50-200ms of latency. Instead:

- Client immediately shows the result (deducted cost, incremented producers)
- Server confirms within milliseconds
- If server rejects (shouldn't happen in normal play), client rolls back to server state

### Handling Server Rejection

If the server returns 400 (invalid action):
1. Client reverts to the state from the last successful server response
2. A subtle toast/warning could be shown, but this should never happen in legitimate play
3. Log the incident for debugging

---

## 8. Plausibility Check Algorithm

### When It Runs

The `/api/game/sync` endpoint runs a plausibility check every time the client syncs (every 15 seconds). It compares what the client claims to have produced against what's physically possible.

### The Algorithm

For each resource, the server calculates the **maximum possible production** since the last sync:

```
For each resource (processed in tier order, lowest first):

  elapsed = now - lastSyncTimestamp

  if resource is not unlocked OR resource is paused:
    maxProduction = 0
  else:
    runTimeMs = baseRunTime * 1000
    maxRuns = floor(elapsed / runTimeMs)
    maxProduction = maxRuns * producers

  actualGain = claimedAmount - amountAtLastSync

  // Allow 10% tolerance for timing drift, network delay, etc.
  if actualGain > maxProduction * 1.10:
    FLAGGED — correct to: amountAtLastSync + maxProduction
```

### Resource Chain Considerations

Higher-tier resources consume lower-tier resources as input. The plausibility check must account for this:

```
For Plates (tier 1, consumes Iron Ore):
  inputCostPerRun = 4 * producers
  maxRunsLimitedByInput = floor(availableIronOre / inputCostPerRun)
  maxRuns = min(maxRunsByTime, maxRunsLimitedByInput)
```

However, since production and consumption happen dynamically during the 15-second window, an exact simulation would require replaying every tick. Instead, use a **generous upper bound**:

- Calculate max runs by time alone (ignoring input constraints)
- This means the plausibility check won't catch cheaters who bypass input costs but produce at a plausible rate
- Input cost cheating is partially covered by server-validated upgrades: you can't get more producers without the server approving

This is an acceptable trade-off. The server prevents the most impactful cheats (free upgrades, impossible production rates). Subtle resource-chain exploitation is low-impact and hard to detect without a full server-side simulation.

### Tolerance

A 10% tolerance accounts for:
- `requestAnimationFrame` timing not being perfectly precise
- Network latency between client completing a run and sync arriving
- JavaScript `Date.now()` precision differences
- Runs that complete between the client building the sync payload and the server processing it

### What Triggers a Warning

When `actualGain > maxProduction * 1.10`:
1. Server corrects the resource amount to `amountAtLastSync + maxProduction`
2. Server increments `session.warnings` counter
3. Server returns `warning: "Resource production exceeded plausible rate"` in the sync response
4. Client displays a non-blocking warning message
5. Repeated warnings (e.g., 5+) could flag the session for review when leaderboards launch

---

## 9. Sync Protocol

### Frequency

Client syncs every **15 seconds** via `POST /api/game/sync`. This interval balances:
- Cheat detection granularity (15s is short enough to catch blatant cheats)
- Server cost (4 requests/minute/player vs. 12 for 5s intervals)
- Network overhead (one HTTP round-trip every 15s is negligible)

### Sync Payload

Client sends:
```json
{
  "state": {
    "resources": { ... },  // Full serialized game state
    "lastSavedAt": 1707753600000
  },
  "serverVersion": 42
}
```

### Server Response

Three possible outcomes:

**1. Accepted (no issues):**
```json
{
  "state": null,
  "serverVersion": 43,
  "warning": null
}
```
Client keeps its current state, updates `serverVersion`.

**2. Corrected (plausibility violation):**
```json
{
  "state": { ... },  // Corrected state
  "serverVersion": 43,
  "warning": "Iron Ore production exceeded plausible rate"
}
```
Client replaces its state with the corrected version. Shows warning.

**3. Conflict (stale serverVersion):**
```json
HTTP 409 Conflict
{
  "state": { ... },  // Server's current state
  "serverVersion": 43
}
```
Client replaces its state with the server's version (another tab may have updated).

### State Reconciliation

After every sync response:
1. If `state` is non-null → replace local state entirely
2. Update local `serverVersion`
3. Update the sync snapshot baseline in Redis for next plausibility check
4. If `warning` is non-null → display warning toast

---

## 10. Client-Side Changes

### GameStateProvider Modifications

The `game-state-context.tsx` file is the most heavily modified component. Key changes:

**Loading:**
```
Before: useEffect → loadGame() from localStorage
After:  useEffect → fetch GET /api/game → set state
        If 404 → POST /api/session + initialize fresh game + POST /api/game/save
```

**Auto-Save:**
```
Before: setInterval(5s) → saveGame() to localStorage
After:  setInterval(5s) → POST /api/game/save with serverVersion
```

**Sync (new):**
```
New: setInterval(15s) → POST /api/game/sync
     → If corrected state returned, replace local state
     → If warning, show toast
```

**Upgrade Actions:**
```
Before: setState(buyProducer(current, resourceId))
After:  setState(buyProducer(current, resourceId))  // optimistic
        POST /api/game/buy-producer { resourceId, serverVersion }
        → On success: setState(serverState), update serverVersion
        → On failure: setState(serverState)  // rollback
```

**Game Loop (unchanged):**
The RAF-based tick that checks `isRunComplete` and auto-starts runs stays exactly as-is. This is the "client leads production" part of the architecture.

### New State Fields

Add to the React state (not persisted to Redis):
- `serverVersion: number` — tracks optimistic concurrency
- `isSyncing: boolean` — prevents concurrent syncs
- `isLoading: boolean` — shows loading state on initial fetch

### localStorage as Cache

Keep localStorage as a **read-through cache** for faster initial render:
- After each server response, also write to localStorage
- On mount, immediately render from localStorage while fetching from server
- Once server responds, replace state and localStorage
- This eliminates blank screen while waiting for the server

---

## 11. Code Organization

### Current Structure

```
src/
  game/
    config.ts          ← Pure data (no dependencies)
    types.ts           ← Pure types (no dependencies)
    logic.ts           ← Pure functions (imports config, types, big-number)
    persistence.ts     ← localStorage-specific (imports big-number serialization)
    game-state-context.tsx  ← React context + game loop
    initial-state.ts   ← Pure function
    ...
  lib/
    big-number.ts      ← Pure math (no dependencies)
```

### Key Insight: No Restructuring Needed

The existing game logic is already perfectly structured for server sharing:
- `logic.ts`, `config.ts`, `types.ts`, `initial-state.ts`, and `big-number.ts` are **pure functions with zero DOM/React/browser dependencies**
- They use `@/` path aliases which work identically in Next.js API routes
- Next.js API routes in `src/app/api/` can import from `src/game/` and `src/lib/` directly

No need to extract a "shared" package or restructure directories. Just import the same files from both client components and API routes.

### New Files to Create

```
src/
  app/
    api/
      session/
        route.ts              ← POST /api/session
      game/
        route.ts              ← GET /api/game
        save/
          route.ts            ← POST /api/game/save
        sync/
          route.ts            ← POST /api/game/sync
        buy-producer/
          route.ts            ← POST /api/game/buy-producer
        buy-max-producers/
          route.ts            ← POST /api/game/buy-max-producers
        buy-automation/
          route.ts            ← POST /api/game/buy-automation
        unlock/
          route.ts            ← POST /api/game/unlock
        toggle-pause/
          route.ts            ← POST /api/game/toggle-pause
        reset/
          route.ts            ← POST /api/game/reset
  lib/
    redis.ts                  ← Upstash Redis client singleton
    session.ts                ← Session validation helpers
    plausibility.ts           ← Plausibility check algorithm
    api-helpers.ts            ← Shared API route utilities (error responses, state loading)
```

### Persistence Layer Changes

`persistence.ts` currently has localStorage-specific code. Refactor to:
- Extract `serializeGameState` / `deserializeGameState` into a separate `serialization.ts` (shared by client cache and server)
- Keep `saveGame` / `loadGame` / `clearSave` for the localStorage cache layer
- Server uses `serialization.ts` functions directly with Redis

---

## 12. Security

### Rate Limiting

Apply rate limits per session ID:
- Upgrade actions (buy, unlock, automate): **10 requests/second** (generous for "buy max" spam)
- Sync: **1 request/10 seconds** (can't sync faster than the interval)
- Save: **1 request/3 seconds**
- Session creation: **5 requests/minute per IP** (prevents session farming)

Implementation: Use Upstash's `@upstash/ratelimit` library (designed for serverless).

### CSRF Protection

Since we're using `SameSite=Strict` cookies and the API only accepts `POST` with JSON bodies (not form submissions), CSRF attacks are mitigated. For defense in depth:
- Verify `Content-Type: application/json` on all POST routes
- Optionally check `Origin` header matches the expected domain

### Session Hijacking Prevention

- `HttpOnly` cookie: JavaScript cannot read the session token
- `Secure` flag: Cookie only sent over HTTPS
- `SameSite=Strict`: Cookie not sent on cross-origin requests
- Session bound to nothing else (no IP binding — too restrictive for mobile networks)

### Input Validation

Every API route must validate:
- `resourceId` is one of the 6 valid ResourceId values
- `serverVersion` is a positive integer
- `state` (when sent) has the correct shape with valid BigNum values (mantissa in [0, 10), exponent is finite integer)
- No unexpected extra fields

Use a lightweight validation approach (manual checks or a small schema library). Avoid heavy dependencies.

### What the Client Should Never Be Trusted With

- Resource amounts (validated via plausibility checks)
- Whether a purchase is affordable (server re-validates)
- Whether a resource is unlocked/automated (server checks from its own state)
- The `serverVersion` value itself (server uses its own stored version, client's is just for optimistic concurrency)

---

## 13. Edge Cases

### Multiple Browser Tabs

Problem: Two tabs = two game loops producing resources simultaneously.

Solution: The `serverVersion` mechanism handles this:
- Tab A syncs with version 42, gets version 43
- Tab B tries to sync with version 42, gets 409 Conflict
- Tab B receives the latest state (which includes Tab A's progress)
- Tab B replaces its state and continues

Net effect: Only one tab's progress "counts" per sync interval. The other tab gets overwritten. This is acceptable — multi-tab idle gaming is an edge case.

Optional improvement: Use `BroadcastChannel` API to detect multiple tabs and show a "game is open in another tab" warning.

### Browser Tab Going to Background

When a tab is backgrounded, `requestAnimationFrame` stops firing. When the user returns:
- The game loop resumes and immediately detects any completed runs (based on `Date.now()` timestamps)
- The next sync sends the accumulated production for plausibility checking
- Since the plausibility check uses elapsed time, a player who backgrounds for 5 minutes and returns will have their production validated against 5 minutes of elapsed time — this works correctly

### Clock Manipulation

If a player sets their system clock forward:
- `Date.now()` would show runs as instantly complete
- Client would claim massive production in 15 seconds of real elapsed time
- The **server** uses its own `Date.now()` for the plausibility check elapsed time
- `elapsed = serverNow - lastSyncTimestamp` (where `lastSyncTimestamp` was set by the server)
- Clock manipulation is fully defeated because the server controls the time reference

### Network Interruption

If a sync/save request fails:
- Client retries with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Game continues running locally (production accumulates)
- On reconnection, sync sends the accumulated state
- Plausibility check uses the full elapsed time since last successful sync
- If offline too long (>5 minutes), force a re-sync on reconnection

### Rapid Clicking / Automation Tools

- Manual run starts (`startResourceRun`) are **client-only** and don't hit the server
- A player could use an autoclicker, but it only starts runs — it can't produce faster than the run timer allows
- The plausibility check catches any impossible production rates regardless of click speed
- Upgrade purchases hit the server, so rapid buy-clicks are rate-limited

---

## 14. Migration Path

### Existing Players (localStorage)

Players with existing localStorage saves should not lose progress:

1. On first load with the new code, client detects no `pf-session` cookie
2. Client creates a new session via `POST /api/session`
3. Client reads existing state from localStorage (the `loadGame()` function)
4. Client sends this state to `POST /api/game/save` as the initial server state
5. Server stores it in Redis — player's progress is now server-backed
6. localStorage continues as a cache

### Rollback Safety

If the server-side system has issues:
- localStorage cache always has a recent copy of state
- A feature flag can switch back to localStorage-only mode
- No data is ever deleted from localStorage during the migration

### Save Version Bump

Increment `SAVE_VERSION` from 3 to 4 to mark the new format (with `serverVersion` field). Old saves are still compatible via the existing migration path (load and re-save in new format).

---

## 15. Implementation Phases

### Phase 1: Infrastructure

- Install `@upstash/redis` and `@upstash/ratelimit`
- Create `src/lib/redis.ts` with Upstash client
- Create `src/lib/session.ts` with session management
- Set up environment variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- Extract serialization functions from `persistence.ts` into `serialization.ts`

### Phase 2: Session + State Storage

- Implement `POST /api/session` route
- Implement `GET /api/game` route
- Implement `POST /api/game/save` route
- Implement `POST /api/game/reset` route
- Modify `GameStateProvider` to load from server and save to server
- Keep localStorage as fallback cache

### Phase 3: Server-Validated Actions

- Implement `POST /api/game/buy-producer` route
- Implement `POST /api/game/buy-max-producers` route
- Implement `POST /api/game/buy-automation` route
- Implement `POST /api/game/unlock` route
- Implement `POST /api/game/toggle-pause` route
- Add optimistic update + server reconciliation to `GameStateProvider`
- Add `serverVersion` concurrency control

### Phase 4: Plausibility Checks

- Implement `src/lib/plausibility.ts` algorithm
- Implement `POST /api/game/sync` route
- Add 15-second sync interval to `GameStateProvider`
- Add warning UI for plausibility violations
- Add `sync:{sessionId}` snapshot management

### Phase 5: Hardening

- Add rate limiting to all routes
- Add input validation to all routes
- Add multi-tab detection (optional)
- Add network interruption handling with retry logic
- Add the localStorage migration flow for existing players
- Bump `SAVE_VERSION` to 4

---

## 16. Open Questions

1. **Sync interval tuning** — 15 seconds is a starting point. May need adjustment based on Upstash usage/cost once deployed. Monitor requests per minute.

2. **Warning threshold** — When does a player go from "occasional warning" to "flagged cheater"? Need a policy before leaderboards launch (e.g., 10+ warnings in a session = flagged).

3. **Offline grace period** — "Always online required" is strict. Should there be a short offline buffer (e.g., 30 seconds of no server contact before pausing the game)?

4. **Account system timing** — When will account linking be added? The session system is designed for it, but the UI/UX of the registration flow needs design.

5. **Database migration** — Redis TTLs mean inactive players lose state after 30 days. When moving to a persistent database, all active game states should be migrated. The serialization format is database-agnostic by design.

6. **Leaderboard integration** — What metric goes on the leaderboard? Total resources produced? Highest tier unlocked? Speed to unlock all tiers? This affects what the server needs to track beyond game state.
