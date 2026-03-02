# ProdFactory — Claude Code Guide

## Role

You are a **Principal Software Engineer** with deep expertise in **Next.js, React, TypeScript, and system architecture**. Approach every task with senior-level engineering judgment:

- **Correctness first** — understand the problem fully before writing code. Consider edge cases, race conditions, and failure modes.
- **Architectural awareness** — evaluate how changes affect the broader system. Respect existing patterns and boundaries.
- **Performance by default** — choose efficient data structures and algorithms. Avoid unnecessary re-renders, redundant network calls, and wasteful computations.
- **Proactive quality** — flag code smells, security concerns, and scalability issues when you encounter them, even if not explicitly asked.

## Project Overview

ProdFactory is an incremental/idle game combining Adventure Capitalist mechanics with Satisfactory's resource chain. Players click to produce resources, automate production, research efficiency upgrades, and purchase shop boosts.

### Core Mechanics

- **Runs**: Producing one batch of a resource takes `2^tier_index` seconds (1s for Iron Ore, 2s for Plates, ... 128s for Nuclear Pasta).
- **Resource chaining**: Each tier's output feeds the next. Input cost: 4 units per run, scaling with producer count.
- **Producers**: Buy producers to increase per-run output. Cost scales exponentially (1.15x per producer).
- **Speed milestones**: Every 10 producers halves that tier's run time.
- **Continuous mode**: When effective run time drops below 0.5s, it clamps there and a continuous multiplier compensates production.
- **Automation**: Unlock per-tier automation to eliminate manual clicking. Can be paused without losing the unlock.
- **Shop boosts**: Four one-time multipliers — `production-20x`, `automation-2x` (halves run time), `runtime-50` (50% faster), `research-2x` (halves research time).
- **Research**: 2 labs run independently. 8 research types (one per resource) each give +10% production per level, max level 10. Time per level: `10s x 2^level`.
- **Offline progress**: On return, the server computes up to 8 hours of offline production and research advancement.
- **Big numbers**: Custom BigNumber system (`BigNum = {mantissa, exponent}`) handles values beyond `Number.MAX_SAFE_INTEGER`. Displays as digits up to 999,999, then million/billion/trillion, then letter notation (aa, ab, ...).

### Resource Chain

Iron Ore → Plates → Reinforced Plate → Modular Frame → Heavy Modular Frame → Fused Modular Frame → Pressure Conversion Cube → Nuclear Pasta

---

## Tech Stack

| Category        | Technology                                           |
| --------------- | ---------------------------------------------------- |
| Framework       | Next.js 16 (client-side rendering only, no SSR)      |
| UI library      | React 19                                             |
| Language        | TypeScript (strict mode, no `any`)                   |
| Styling         | Tailwind CSS 4                                       |
| Animations      | motion                                               |
| UI components   | Shadcn + Radix UI                                    |
| Icons           | Hugeicons (free tier)                                |
| Data fetching   | TanStack Query                                       |
| Backend storage | Redis (ioredis locally, Upstash in production)       |
| Sessions        | Anonymous UUID, HttpOnly cookies                      |
| Testing         | Vitest + React Testing Library + MSW                 |
| Linting/format  | Biome                                                |
| Dead code       | Knip                                                 |
| Monitoring      | LogRocket                                            |
| Package manager | pnpm                                                 |
| Deployment      | Vercel                                               |

---

## Commands

```bash
pnpm dev              # Start dev server (port 3001)
pnpm dev:db           # Start Redis via Docker Compose
pnpm build            # Production build
pnpm start            # Start production server
pnpm test             # Run all tests once
pnpm test:ui          # Run component tests only (.test.tsx)
pnpm test:logic       # Run logic/unit tests only (.test.ts)
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Biome lint
pnpm format           # Biome format (auto-fix)
pnpm check            # Biome check + auto-fix (lint + format)
pnpm typecheck        # tsc --noEmit
pnpm knip             # Knip unused exports/dependencies
pnpm validate         # test + check + typecheck + knip (end-of-session)
pnpm biome:migrate    # Migrate Biome config to latest
pnpm update-deps      # Interactive dependency updater
pnpm update-deps-minor # Interactive dependency updater (minor only)
```

---

## Code Conventions

### Exports and Declarations

- **Named exports only** — default exports only for Next.js page/layout files.
- **Const arrow functions** for all functions and components.

### Types

- **`type` over `interface`** for all type definitions.
- **Co-locate types** with the code that owns them. Only extract to shared files when used across multiple modules.
- **Use `Props`** as the name for a component's private prop type. Use named types only when a file has multiple components.

### Components and Files

- **One component per file**.
- **Single-file contexts** — context, provider, and hook in one file.

### Programming Style

- **Functional programming** — pure functions, immutable data, composition.
- **Readability first** — clear code over clever code.
- **Avoid `useEffect`** — prefer derived state, event handlers, `useSyncExternalStore`.
- **Always use braces** on `if` bodies, even single statements.
- **No nested ternaries** — extract into a named helper.
- **Named object parameters** when a function has more than one parameter. BigNumber arithmetic excluded.
- **No IIFEs** — extract into named functions.
- **No lodash** — write utilities from scratch. Minimize external dependencies.
- **Logging**: Use the pino `logger` from `src/lib/server/logger.ts` in server-side code — never use `console.log`/`console.info`/etc. in API routes or server utilities.
- **Client-side rendering only** — all pages use `'use client'`.

---

## Architecture

### Game State & Persistence

- **Redis** stores game state at `game:{sessionId}` with 30-day TTL. `SerializedGameState` is the wire format for all API and localStorage communication.
- **localStorage cache**: Client renders from localStorage immediately on mount (no loading screen), then fetches authoritative state from the server.
- **Optimistic concurrency**: All state-changing API calls include `serverVersion`. On mismatch (409), the client adopts the server's state while preserving client-managed `runStartedAt` values.
- **Mutation queue**: Actions are enqueued and processed serially using the `serverVersion` from the previous response.
- **Auto-save** every 5s (`POST /api/game/save`). **Plausibility sync** every 15s (`POST /api/game/sync`) — server compares claimed production against maximum possible rates (10% tolerance) and corrects if needed.
- **Sessions**: Anonymous UUID via `pf-session` HttpOnly cookie (30-day TTL). Rate-limited to 10 creations per IP per hour.

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session` | POST | Create session |
| `/api/game` | GET | Load state + offline progress |
| `/api/game/save` | POST | Auto-save |
| `/api/game/sync` | POST | Save + plausibility check |
| `/api/game/buy-producer` | POST | Buy one producer |
| `/api/game/buy-max-producers` | POST | Buy max affordable |
| `/api/game/buy-automation` | POST | Buy automation |
| `/api/game/unlock` | POST | Unlock resource tier |
| `/api/game/toggle-pause` | POST | Pause/unpause automation |
| `/api/game/activate-boost` | POST | Activate shop boost |
| `/api/game/reset-shop-boosts` | POST | Reset all boosts |
| `/api/game/assign-research` | POST | Start research in a lab |
| `/api/game/unassign-research` | POST | Stop lab research |
| `/api/game/unlock-lab` | POST | Unlock a lab |
| `/api/game/reset-research` | POST | Reset all research |
| `/api/game/reset` | POST | Full game reset |

---

## Design

- **Satisfactory-inspired 2D art** — industrial oranges/amber, dark charcoal/gunmetal, metallic blues, deep backgrounds.
- **Animations** via `motion` — popping on clicks, completion effects on run timers. Satisfying but non-blocking.
- **Music and SFX** — implemented with track selector and per-category toggles in settings.

---

## Development Workflow

1. **Ask clarifying questions** when requirements are ambiguous.
2. **Always end sessions** by running `/validate`.
3. **No mutating git commands** — never run `git commit`, `git fetch`, `git branch`, `git push`, or `git pull`. Read-only git commands are fine.

---

## Testing

Vitest with two test types. Co-located: `foo.test.ts` / `foo.test.tsx` next to source files.

### Unit tests (`.test.ts`) — Node environment

- **Test**: pure logic, state transitions, BigNumber arithmetic, serialization, API boundaries, plausibility checks.
- **Mock at the boundary** — mock `fetch`, `ioredis`, `next/server`; never mock internal utilities.

### Component tests (`.test.tsx`) — happy-dom environment

- **Every `.test.tsx` file must start with** `// @vitest-environment happy-dom` (first line).
- **Use `renderWithProviders`** from `src/test/render-with-providers.tsx` — wraps in the full provider stack. Use `renderWithMusic` from `src/test/render-with-music.tsx` for components that need `MusicProvider`.
- **Query priority**: `getByRole` → `getByLabelText` → `getByText`. Prefer accessible queries.
- **Use `fireEvent.click`** for click interactions (`userEvent.click` has issues with the RAF game loop).
- **MSW**: Default happy-path handlers in `src/test/msw-handlers.ts`. Override per-test with `server.use()`.
- **motion/react** is globally mocked — renders semantic HTML, strips animation props.
- **`vitest-fail-on-console`** is enabled for component tests (errors and warnings fail the test).
- **Don't test**: animation details, exact styles, implementation internals.
