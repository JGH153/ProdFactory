# Accessibility Evaluation & Remediation Plan

## Context

ProdFactory has solid foundations — Radix UI primitives, accessible test queries (`getByRole`), Biome's built-in a11y lint rules — but a comprehensive audit found **32 accessibility issues** across the frontend. The most impactful are: missing keyboard support on core interactions, no screen reader announcements for dynamic content, insufficient color contrast, missing focus indicators, and no `prefers-reduced-motion` support.

The user also asked about **tooling improvements** to catch and prevent a11y regressions going forward.

---

## Phase 0 — Tooling (prevent future regressions)

### 0.1 Add `vitest-axe` for automated WCAG scanning
- `pnpm add -D vitest-axe`
- [src/test/setup.ts](src/test/setup.ts) — register `toHaveNoViolations` matcher in the existing `isDOM` block
- Add an axe scan assertion to 2–3 key component tests as examples (e.g., `resource-card.test.tsx`, `bottom-nav.test.tsx`)

### 0.2 Enable additional Biome a11y rules
- [biome.json](biome.json) — add explicit rules beyond `recommended`:
  - `useButtonType: "error"` — require `type` on all `<button>` elements
  - `useFocusableInteractive: "error"` — interactive elements must be focusable
  - `useSemanticElements: "warn"` — prefer native elements over ARIA roles

### 0.3 Playwright a11y testing (optional enhancement)
- The project already has Playwright available via MCP. A future enhancement could add `@axe-core/playwright` for full-page scans during E2E testing, but this is not a blocking item.

---

## Phase 1 — Critical Barriers (HIGH severity)

### 1.1 Fix `text-muted` contrast
- [src/app/globals.css](src/app/globals.css) — change `--color-text-muted` and `--color-muted-foreground` from `#6b6b80` (~3.3:1) to `#8c8ca0` (~5.0:1 on dark background, passes WCAG AA)
- Fixes contrast across ~10 component files in one change

### 1.2 Add skip link
- [src/app/layout.tsx](src/app/layout.tsx) — add visually-hidden skip link (`sr-only focus:not-sr-only`) as first child of `<body>`
- [src/app/page.tsx](src/app/page.tsx) — add `id="main-content"` to `<main>`

### 1.3 RunButton: accessible name + focus ring
- [src/components/resource/run-button.tsx](src/components/resource/run-button.tsx) — add `aria-label={`Start ${config.name} production run`}` and `focus-visible:ring-2 focus-visible:ring-ring` classes to the `motion.button`

### 1.4 LabCard cancel button: accessible name
- [src/components/research/lab-card.tsx](src/components/research/lab-card.tsx) — add `aria-label="Cancel research"` to the icon-only cancel button (line ~153)

### 1.5 Milestone notifications: keyboard + live region
- [src/game/state/milestone-context.tsx](src/game/state/milestone-context.tsx):
  - Add `onKeyDown` handler (Enter/Space) to the `motion.div` with `role="button"`
  - Add `role="log"` + `aria-live="polite"` + `aria-label="Game notifications"` to the container div

### 1.6 Locked ResourceCard: prevent focus on covered buttons
- [src/components/resource/resource-card.tsx](src/components/resource/resource-card.tsx) — add `inert` attribute to `CardContent` when `isLocked` is true, preventing keyboard focus on buttons hidden behind the `UnlockOverlay`

### 1.7 All spinner elements: add `aria-hidden="true"`
- Files: [unlock-overlay.tsx](src/components/resource/unlock-overlay.tsx), [reset-research-button.tsx](src/components/settings/reset-research-button.tsx), [reset-shop-button.tsx](src/components/settings/reset-shop-button.tsx), [shop-page.tsx](src/components/shop/shop-page.tsx), [research-picker-dialog.tsx](src/components/research/research-picker-dialog.tsx)

---

## Phase 2 — Interactive Patterns (MEDIUM severity)

### 2.1 Complete the ARIA tabs pattern
- [src/components/layout/bottom-nav.tsx](src/components/layout/bottom-nav.tsx) — add `aria-label="Main navigation"` to `<nav>`, add `id={`tab-${tab.id}`}` + `aria-controls={`tab-panel-${tab.id}`}` to each tab button
- [src/app/page.tsx](src/app/page.tsx) — wrap each page component in `<div role="tabpanel" id={`tab-panel-${id}`} aria-labelledby={`tab-${id}`}>`

### 2.2 Prestige success: keyboard dismissal
- [src/components/prestige/prestige-page.tsx](src/components/prestige/prestige-page.tsx) — convert the success overlay `div` to a `<button>` (or add `role="button"`, `tabIndex={0}`, `onKeyDown`)

### 2.3 AutomateButton: add `aria-pressed`
- [src/components/resource/automate-button.tsx](src/components/resource/automate-button.tsx) — add `aria-pressed={!resource.isPaused}`

### 2.4 LockedTab: expose tooltip to AT
- [src/components/layout/locked-tab.tsx](src/components/layout/locked-tab.tsx) — add `aria-description={message}` to the button

### 2.5 TrackSelector: label association
- [src/components/settings/track-selector.tsx](src/components/settings/track-selector.tsx) — add `id="music-track-label"` to the "Music Track" span and `aria-labelledby="music-track-label"` to `SelectTrigger`

### 2.6 LabCard idle button: aria-label + focus ring
- [src/components/research/lab-card.tsx](src/components/research/lab-card.tsx) — add `aria-label`, `aria-haspopup="dialog"`, and `focus-visible:ring-*` styles

### 2.7 ResearchPickerItem: focus ring
- [src/components/research/research-picker-dialog.tsx](src/components/research/research-picker-dialog.tsx) — add `focus-visible:ring-*` styles

---

## Phase 3 — Decorative Icons (mechanical, broad)

### 3.1 ResourceIcon: single fix propagates everywhere
- [src/components/resource-icon.tsx](src/components/resource-icon.tsx) — add `aria-hidden="true"` to the `HugeiconsIcon` inside `ResourceIcon`. Fixes all 8 resource tiers at once.

### 3.2 All other decorative HugeiconsIcon usages (~20 callsites)
- Add `aria-hidden="true"` to every `HugeiconsIcon` that appears alongside visible text (bottom-nav icons, settings icons, prestige icons, shop icons, research info icons, offline summary icons, etc.)
- Full file list: [bottom-nav.tsx](src/components/layout/bottom-nav.tsx), [locked-tab.tsx](src/components/layout/locked-tab.tsx), [music-button.tsx](src/components/settings/music-button.tsx), [sfx-button.tsx](src/components/settings/sfx-button.tsx), [settings-page.tsx](src/components/settings/settings-page.tsx), [new-game-button.tsx](src/components/settings/new-game-button.tsx), [reset-research-button.tsx](src/components/settings/reset-research-button.tsx), [reset-shop-button.tsx](src/components/settings/reset-shop-button.tsx), [unlock-overlay.tsx](src/components/resource/unlock-overlay.tsx), [lab-card.tsx](src/components/research/lab-card.tsx), [research-picker-dialog.tsx](src/components/research/research-picker-dialog.tsx), [milestone-context.tsx](src/game/state/milestone-context.tsx), [prestige-milestones.tsx](src/components/prestige/prestige-milestones.tsx), [prestige-page.tsx](src/components/prestige/prestige-page.tsx), [prestige-confirm-modal.tsx](src/components/prestige/prestige-confirm-modal.tsx), [shop-page.tsx](src/components/shop/shop-page.tsx), [research-page.tsx](src/components/research/research-page.tsx), [offline-summary-modal.tsx](src/components/offline-summary-modal.tsx)

---

## Phase 4 — Progress Bars, Live Regions & Semantic Structure

### 4.1 Progress bar accessible labels
- [run-button.tsx](src/components/resource/run-button.tsx) — add `aria-label` to milestone `<Progress>` (e.g., `"Speed milestone for Iron Ore"`)
- [lab-card.tsx](src/components/research/lab-card.tsx) — add `aria-label` to research `<Progress>`
- [offline-summary-modal.tsx](src/components/offline-summary-modal.tsx) — add `aria-label` to offline time `<Progress>`

### 4.2 ProgressBar status text: smart live region
- [src/components/resource/progress-bar.tsx](src/components/resource/progress-bar.tsx) — use `role="status"` (implies `aria-live="polite"`) only for state changes (Paused, Waiting for input), keep rapid timer updates as non-live

### 4.3 List semantics for repeated items
- [game-board.tsx](src/components/layout/game-board.tsx) — wrap resource cards in `<ul>/<li>` (replace `motion.div` → `motion.ul`)
- [research-page.tsx](src/components/research/research-page.tsx) — wrap efficiency/speed research items in `<ul>/<li>`
- [research-picker-dialog.tsx](src/components/research/research-picker-dialog.tsx) — wrap picker items in `<ul>/<li>`
- [prestige-milestones.tsx](src/components/prestige/prestige-milestones.tsx) — wrap milestones in `<ul>/<li>`

### 4.4 Game tab heading + card labels
- [game-board.tsx](src/components/layout/game-board.tsx) — add `<h2 className="sr-only">Factory</h2>`
- [resource-card.tsx](src/components/resource/resource-card.tsx) — add `aria-label={config.name}` to each Card

### 4.5 Header landmark
- [src/app/page.tsx](src/app/page.tsx) — wrap `<Logo />` in `<header>`

---

## Phase 5 — Reduced Motion

### 5.1 CSS animations
- [src/app/globals.css](src/app/globals.css) — add `@media (prefers-reduced-motion: reduce)` block disabling `animate-nuclear-pulse`, `animate-shimmer`, and `animate-spin`

### 5.2 Motion library animations
- Create [src/lib/prefers-reduced-motion.ts](src/lib/prefers-reduced-motion.ts) — export a `prefersReducedMotion()` utility
- [run-button.tsx](src/components/resource/run-button.tsx) — conditionally disable the infinite icon rotation
- [milestone-context.tsx](src/game/state/milestone-context.tsx) — conditionally disable `WiggleSpan` animation

### 5.3 Video captions (known limitation)
- [intro-video-dialog.tsx](src/components/intro-video-dialog.tsx) — remove the empty `<track kind="captions" />` and add a TODO comment for when a VTT file is created

---

## Verification

1. **Automated**: run `pnpm validate` (tests + Biome + TypeScript + Knip) — all must pass
2. **Manual keyboard test**: tab through the entire game without a mouse — every interactive element should be reachable, focusable with a visible ring, and activatable with Enter/Space
3. **Screen reader spot check**: use NVDA or VoiceOver to navigate the Game, Shop, and Research tabs — verify resource cards, buttons, progress bars, and milestone notifications are announced meaningfully
4. **Contrast check**: inspect `text-muted` elements in browser DevTools — verify computed contrast ratio >= 4.5:1
5. **Reduced motion**: enable "Reduce motion" in OS settings, reload — verify no looping animations play
6. **Axe scan**: run axe DevTools extension on the running app — verify no critical/serious violations
