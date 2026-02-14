# ProdFactory — Claude Code Guide

## Project Overview

ProdFactory is an incremental/idle game that combines the layout and mechanics of Adventure Capitalist with the resource chain from Satisfactory. Players click to produce resources, which can later be automated. Produced resources can be spent on upgrades that increase the gain from each run.

### Core Mechanics

- **Runs**: A run is how long it takes to produce one batch of a resource. The base run time starts at 4 seconds and doubles (2x) for each subsequent resource tier.
- **Resource chaining**: The output of one resource tier is consumed as input for the next tier.
- **Automation**: Players can unlock automation for each resource tier to eliminate manual clicking.
- **Upgrades**: Spend produced resources to increase per-run output.
- **Big numbers**: Production values grow extremely large over time, surpassing what JavaScript's `Number` type can represent. A custom BigNumber system handles this (see Architecture section).

### Resource Chain (in order)

1. Iron Ore
2. Plates
3. Reinforced Iron Plate
4. Modular Frame
5. Heavy Modular Frame
6. Fused Modular Frame

Each tier feeds into the next. Iron Ore is the base resource produced from nothing; Plates require Iron Ore; Reinforced Iron Plates require Plates; and so on.

---

## Tech Stack

| Category        | Technology                                  |
| --------------- | ------------------------------------------- |
| Framework       | Next.js (client-side rendering only, no SSR/caching) |
| UI library      | React                                       |
| Language        | TypeScript (strict mode, no `any`)          |
| Styling         | Tailwind CSS                                |
| Animations      | motion                                      |
| UI components   | Shadcn                                      |
| Icons           | Hugeicons (free tier)                       |
| Data fetching   | TanStack Query                              |
| Backend storage | Redis (ioredis locally, Upstash in production) |
| Sessions        | Anonymous UUID, HttpOnly cookies             |
| Linting/format  | Biome                                       |
| Dead code       | Knip                                        |
| E2E testing     | Playwright (to be added later)              |
| Package manager | pnpm                                        |
| Deployment      | Vercel                                      |

---

## Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Start development server
pnpm build          # Production build
pnpm lint           # Run Biome linter
pnpm format         # Run Biome formatter
pnpm check          # Run Biome check (lint + format combined)
pnpm typecheck      # Run tsc --noEmit
pnpm knip           # Run Knip for unused exports/dependencies
pnpm validate       # Run biome check + typecheck + knip (end-of-session command)
pnpm start:db       # Start Redis via Docker Compose
```

---

## Code Conventions

### Exports and Declarations

- **Named exports only** — never use default exports unless a framework requires it (e.g., Next.js page/layout files).
- **Const arrow functions** over function declarations for all functions and components.

```typescript
// Correct
export const calculateProduction = (base: number, multiplier: number): BigNum => {
  // ...
};

export const ResourceButton = ({ resource }: Props) => {
  // ...
};

// Incorrect
export default function calculateProduction(base, multiplier) { ... }
```

### Types

- **Types over interfaces** — use `type` for all type definitions.
- **Co-locate types** with the code that owns them. Only extract to shared type files when a type is used across multiple modules.
- **Use `Props` for co-located prop types** — when a component's props type is private to its file (not exported), name it simply `Props` instead of `ComponentNameProps`. If a file contains multiple components with their own props types (e.g., an internal helper), keep the helper's type named and use `Props` only for the primary exported component.

```typescript
// Co-located type — lives in the same file as the component that uses it
type Props = {
  resource: Resource;
  onUpgrade: (id: string) => void;
};

export const ResourceCard = ({ resource, onUpgrade }: Props) => {
  // ...
};
```

### Components and Files

- **One component per file** — each React component gets its own file.
- **Single-file contexts** — when creating a React context, put the context, provider, and hook in a single file.

```typescript
// game-state-context.tsx — single file context pattern
const GameStateContext = createContext<GameState | null>(null);

export const GameStateProvider: React.FC<PropsWithChildren> = ({ children }) => {
  // state logic here
  return <GameStateContext value={value}>{children}</GameStateContext>;
};

export const useGameState = (): GameState => {
  const context = use(GameStateContext);
  if (!context) {
    throw new Error("useGameState must be used within GameStateProvider");
  }
  return context;
};
```

### Programming Style

- **Functional programming** over object-oriented — prefer pure functions, immutable data, and composition.
- **Readability first** — prioritize clear, readable code over clever or terse solutions.
- **Avoid `useEffect`** — only use `useEffect` when no other React pattern can achieve the goal. Prefer derived state, event handlers, and `useSyncExternalStore` where applicable.
- **Always use braces** — never write single-line `if` statements. Every `if` body must be wrapped in curly braces, even for single-statement returns or throws.
- **No nested ternaries** — never nest ternary expressions more than one level deep. Extract the logic into a named helper function instead. A single ternary (`a ? b : c`) is fine; a nested one (`a ? b : c ? d : e`) is not.
- **Named object parameters** — when a function or constructor has more than one parameter, pass them as a single destructured object for readability. BigNumber arithmetic functions (`bnAdd`, `bnSub`, `bnMul`, etc.) are excluded since they follow mathematical conventions.
- **No lodash** — write utilities from scratch. Minimize external npm packages; only add a dependency when it provides substantial value.
- **No outdated dependencies** — always use current, maintained versions of all packages.

### Next.js Specifics

- **Client-side rendering only** — all pages and components use `'use client'` directives. No server-side rendering, no server components, no caching.
- Page and layout files must use default exports (Next.js requirement). These are the only exception to the named-export rule.

---

## Architecture

### Custom BigNumber System

Production values in idle games grow far beyond `Number.MAX_SAFE_INTEGER`. ProdFactory uses a custom BigNumber implementation (not a third-party library) to handle this.

**Display format progression**: numbers are displayed as standard digits up to 999,999, then abbreviated:

- 1,000,000 → 1.00 million
- 1,000,000,000 → 1.00 billion
- 1,000,000,000,000 → 1.00 trillion
- Beyond standard names: aa, ab, ac, ... az, ba, bb, ... and so on

The custom implementation must support:

- Addition, subtraction, multiplication, and division
- Comparison operators
- Formatting/display with the abbreviation system above
- Serialization to/from JSON for localStorage persistence

### Game State Persistence

- **Primary storage**: Redis via server API routes. Game state is stored at `game:{sessionId}` with a 30-day TTL.
- **localStorage cache**: On every server response, state is also written to localStorage. On mount, the client renders from localStorage immediately (no loading screen) while fetching the authoritative state from the server.
- **Serialization**: Shared `serialization.ts` module used by both the frontend (localStorage) and backend (Redis). `SerializedGameState` is the wire format for all API communication.

### Backend Integration

- **Sessions**: Anonymous UUID sessions created automatically on first API call. The `pf-session` cookie is `HttpOnly; SameSite=Strict` with a 30-day TTL. The client detects a missing session via 401 response and retries after creating one.
- **Server-validated actions**: Purchases, unlocks, automation, and pause toggles are applied optimistically on the client, then confirmed by the server. Successful action responses only update the `serverVersion` — the client trusts its own optimistic state (since identical pure logic functions run on both sides). Only conflict (409) responses trigger state reconciliation. Runs (startRun/completeRun) are client-only.
- **Mutation queue**: Action requests are enqueued and processed serially. Each request uses the `serverVersion` from the previous response, preventing 409 conflicts from rapid clicking.
- **Auto-save**: Every 5 seconds via `POST /api/game/save` (replaces localStorage-only save). Save and sync requests are guarded against racing with the action queue — responses are ignored if actions were enqueued while the request was in-flight.
- **Plausibility sync**: Every 15 seconds via `POST /api/game/sync`. The server compares claimed production against maximum possible rates (10% tolerance) and corrects if needed.
- **Optimistic concurrency**: Every state-changing API call includes a `serverVersion` number. On mismatch (409), the client adopts the server's state.
- **Run preservation**: When reconciling server state, the client preserves its own `runStartedAt` values since runs are client-managed.

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session` | POST | Create anonymous session |
| `/api/game` | GET | Load game state |
| `/api/game/save` | POST | Persist state (auto-save) |
| `/api/game/sync` | POST | Persist + plausibility check |
| `/api/game/buy-producer` | POST | Buy producer (server-validated) |
| `/api/game/buy-max-producers` | POST | Buy max producers |
| `/api/game/buy-automation` | POST | Buy automation |
| `/api/game/unlock` | POST | Unlock resource tier |
| `/api/game/toggle-pause` | POST | Toggle automation pause |
| `/api/game/reset` | POST | Reset to initial state |

### Run Timing

| Resource Tier          | Run Time |
| ---------------------- | -------- |
| Iron Ore               | 4s       |
| Plates                 | 8s       |
| Reinforced Iron Plate  | 16s      |
| Modular Frame          | 32s      |
| Heavy Modular Frame    | 64s      |
| Fused Modular Frame    | 128s     |

Each tier's base run time is `4 * 2^(tier_index)` seconds.

---

## Design and Art Direction

### Visual Style

- **Satisfactory-inspired 2D art** — the game draws from Satisfactory's industrial aesthetic but rendered in a flat 2D style.
- Use a color palette inspired by Satisfactory:
  - Industrial oranges and warm amber tones
  - Dark charcoal and gunmetal greys
  - Metallic blues and steel accents
  - Deep backgrounds with lighter foreground elements

### Animations

- **Popping animations** on resource clicks (feedback for manual production).
- **Completion animations** when a run timer finishes.
- All animations implemented with the `motion` library.
- Animations should feel satisfying and responsive but not block gameplay.

### Future Plans

- Music and sound effects will be added in a later iteration.

---

## Development Workflow

1. **Ask clarifying questions** when requirements are ambiguous — do not proceed until 98% confident of the intent.
2. Write modular, extendable code that follows the conventions above.
3. **Always end sessions** by running `/validate` to catch lint errors, type errors, and dead code before committing.
4. Keep the codebase clean — no unused exports, no dead code, no type errors.
5. **No mutating git commands** — never run `git commit`, `git fetch`, `git branch`, `git push`, or `git pull`. Read-only commands like `git log`, `git status`, and `git diff` are fine. The user manages all git mutations manually.
