# Epic 3 Reef Threat Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, ocean-themed single-page Reef Threat Explorer with a swipeable threat carousel, concise threat details, a tap-only identification exercise, and low-friction report links.

**Architecture:** Add a server-rendered `/reef-threats` route that composes one focused Epic 3 client experience. Store content and image metadata in a typed data module, keep interactive selection and exercise state inside the client component, and use a dedicated CSS module for responsive scroll-snap layout and reduced-motion behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-11-epic-3-threat-explorer-design.md`

## Global Constraints

- Reuse repository-owned threat images; add no animation or carousel dependency.
- Provide keyboard, pointer, touch, and reduced-motion behavior.
- Keep educational content distinct from AI analysis of uploaded evidence.
- Preserve selected threat in the existing report flow query string.
- Public visitors pass through login; authenticated observers report directly.

---

### Task 1: Threat content and interaction contract

**Files:**
- Create: `features/epic-03-threat-explorer/threat-explorer-data.ts`
- Create: `features/epic-03-threat-explorer/__tests__/threat-explorer.test.tsx`

**Interfaces:**
- Produces: `ThreatExplorerCode`, `ThreatExplorerItem`, `threatExplorerItems`, `spotTheThreatExamples`
- Each threat exposes `code`, `label`, `number`, `eyebrow`, `summary`, `looksLike`, `impact`, `recognitionCues`, `safety`, `image`, and `imageAlt`.

- [ ] **Step 1: Write the failing component contract test**

```tsx
render(<AuthProvider><ThreatExplorer /></AuthProvider>);
expect(screen.getByRole("heading", { name: /meet the four threats/i })).toBeInTheDocument();
expect(screen.getAllByRole("button", { name: /explore/i })).toHaveLength(4);
expect(screen.getByText(/lost or abandoned nets/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `npm test -- features/epic-03-threat-explorer/__tests__/threat-explorer.test.tsx`

- [ ] **Step 3: Add the typed data for all four threats and two prepared exercises**

The data module must use existing `/images/threats/*` assets and concise, factual copy derived from the approved user-story scope.

- [ ] **Step 4: Commit the content contract**

```bash
git add features/epic-03-threat-explorer
git commit -m "test: define Epic 3 explorer contract"
```

### Task 2: Interactive explorer component

**Files:**
- Create: `features/epic-03-threat-explorer/threat-explorer.tsx`
- Modify: `features/epic-03-threat-explorer/__tests__/threat-explorer.test.tsx`

**Interfaces:**
- Consumes: `threatExplorerItems`, `spotTheThreatExamples`
- Produces: `ThreatExplorer(): JSX.Element`
- Uses `useAuth()` to build `/report-a-reef?threat=<code>` or `/login?next=<encoded path>`.

- [ ] **Step 1: Expand tests for selection, next/previous controls, exercise feedback, and report links**

```tsx
await user.click(screen.getByRole("button", { name: /explore coral bleaching/i }));
expect(screen.getByRole("heading", { name: "Coral bleaching" })).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /coral bleaching/i, pressed: false }));
expect(screen.getByRole("status")).toHaveTextContent(/correct/i);
expect(screen.getByRole("link", { name: /report this threat/i })).toHaveAttribute("href", expect.stringContaining("coral_bleaching"));
```

- [ ] **Step 2: Run tests and verify they fail before implementation**

Run: `npm test -- features/epic-03-threat-explorer/__tests__/threat-explorer.test.tsx`

- [ ] **Step 3: Implement selection and carousel controls**

Use button cards with `aria-pressed`, a labelled horizontal scroll region, refs for `scrollIntoView`, bounded previous/next state, and a live `N of 4` indicator.

- [ ] **Step 4: Implement detail, Spot the Threat, and uncertain report actions**

Keep feedback inside `role="status"`; category choices are buttons; `Next example` cycles through prepared examples and resets feedback.

- [ ] **Step 5: Run the focused tests until all pass**

Run: `npm test -- features/epic-03-threat-explorer/__tests__/threat-explorer.test.tsx`

- [ ] **Step 6: Commit the interaction layer**

```bash
git add features/epic-03-threat-explorer
git commit -m "feat: add interactive reef threat explorer"
```

### Task 3: Ocean visual system and responsive motion

**Files:**
- Create: `features/epic-03-threat-explorer/threat-explorer.module.css`
- Modify: `features/epic-03-threat-explorer/threat-explorer.tsx`

**Interfaces:**
- Consumes semantic class hooks from `ThreatExplorer`.
- Produces responsive layouts at `900px` and `640px`, scroll snap, visible focus states, and reduced-motion overrides.

- [ ] **Step 1: Add the ocean background, editorial hero, card rail, detail layout, exercise layout, and CTA styles**

Use deep teal `#063d4c`, ocean blue `#0b7189`, seafoam `#dff7f3`, white surfaces, restrained shadows, and 18–28px corner radii.

- [ ] **Step 2: Add purposeful motion**

Use one entrance animation, selected-card transform, smooth scroll, and a 260ms detail transition. Under `@media (prefers-reduced-motion: reduce)`, remove animations and smooth scrolling.

- [ ] **Step 3: Run lint and focused tests**

Run: `npm run lint && npm test -- features/epic-03-threat-explorer/__tests__/threat-explorer.test.tsx`

- [ ] **Step 4: Commit the visual system**

```bash
git add features/epic-03-threat-explorer
git commit -m "style: add ocean explorer visual system"
```

### Task 4: Public route and navigation

**Files:**
- Create: `app/(public)/reef-threats/page.tsx`
- Modify: `config/navigation.ts`
- Test: `features/epic-03-threat-explorer/__tests__/navigation.test.ts`

**Interfaces:**
- Route metadata title: `Reef Threat Explorer`.
- Navigation item: `{ label: "Reef threats", href: "/reef-threats" }` for public and observer navigation.

- [ ] **Step 1: Write a failing navigation test**

```ts
expect(publicNavigation).toContainEqual({ label: "Reef threats", href: "/reef-threats" });
expect(observerNavigation).toContainEqual({ label: "Reef threats", href: "/reef-threats" });
```

- [ ] **Step 2: Run it and verify it fails because the item is absent**

Run: `npm test -- features/epic-03-threat-explorer/__tests__/navigation.test.ts`

- [ ] **Step 3: Add the route and navigation entries**

```tsx
export const metadata: Metadata = { title: "Reef Threat Explorer" };
export default function ReefThreatsPage() { return <ThreatExplorer />; }
```

- [ ] **Step 4: Run navigation and explorer tests**

Run: `npm test -- features/epic-03-threat-explorer/__tests__`

- [ ] **Step 5: Commit the public entry point**

```bash
git add app/'(public)'/reef-threats config/navigation.ts features/epic-03-threat-explorer/__tests__/navigation.test.ts
git commit -m "feat: publish Reef Threat Explorer route"
```

### Task 5: Full verification and browser QA

**Files:**
- Modify only files needed to repair verified defects.

**Interfaces:**
- Produces a production-buildable, accessible, responsive `/reef-threats` experience.

- [ ] **Step 1: Run the repository quality gate**

Run: `npm run check`

- [ ] **Step 2: Run a production build**

Run: `npm run build`

- [ ] **Step 3: Start the app and inspect `/reef-threats` at desktop and mobile widths**

Verify threat selection, previous/next bounds, horizontal swipe, exercise feedback, report URLs, focus visibility, image loading, overflow, and reduced motion.

- [ ] **Step 4: Repair any observed defects and rerun affected tests plus `npm run check`**

- [ ] **Step 5: Commit verified repairs if any**

```bash
git add app config features
git commit -m "fix: polish Epic 3 explorer verification"
```
