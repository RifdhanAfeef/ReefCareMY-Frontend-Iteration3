# Epic 3 Reef Threat Explorer Design

## Purpose

Create a public, single-page Reef Threat Explorer that helps visitors recognise ReefCare MY's four supported reef threats, understand why each matters, and move into reporting without requiring scientific knowledge or lengthy input.

## Experience direction

The page uses a calm ocean palette and a restrained, Apple-inspired motion language. Motion supports orientation rather than decoration: elements ease into place, the selected threat gains gentle scale and depth, and horizontally scrollable modules snap into stable positions. Every effect respects `prefers-reduced-motion`.

The interface stays concise and location-aware. A persistent section label, clear headings, selected-card state, and progress markers tell visitors where they are. The page avoids forms; users explore through swipe, scroll, click, and keyboard controls.

## Page structure

### Ocean introduction

A full-width hero introduces the four supported threats with a short statement, one primary action to begin exploring, and a quiet ocean-depth visual treatment. The introduction should fit within the first viewport on common laptop screens without hiding the next section completely.

### Threat carousel

Four horizontally scrollable cards represent Ghost fishing gear, Coral bleaching, Marine debris, and Physical reef damage. The carousel uses CSS scroll snap, visible overflow cues, previous and next controls, keyboard navigation, and a compact `1 of 4` indicator. Selecting a card updates the detail module below without navigation or text input.

### Threat detail

The selected threat appears in a two-column editorial layout containing:

- a representative image and plain-language identity cue
- what it looks like
- why it matters
- two or three recognition cues
- a prominent safety reminder
- a direct reporting action that preserves the selected threat in the reporting URL

Content changes should animate with a short fade and vertical transition. The selected content remains available to screen readers and focus is not moved unexpectedly after pointer selection.

### Spot the Threat

A lightweight educational slider presents prepared example images and a small set of category choices. The visitor answers by tapping a category rather than typing. Immediate feedback explains the most useful visual cue and offers the next example. This is education only and must not imply AI analysis of user-uploaded evidence.

### Unsure and report pathway

The final section makes uncertainty acceptable. Visitors can choose `I am unsure` and continue to the existing report flow, while unauthenticated visitors are routed through login with a return URL. The page repeats the rule not to touch, move, or remove reef objects unless trained and authorised.

## Visual system

- Background: layered deep teal, clear-water blue, and pale seafoam sections, with sufficient text contrast.
- Surfaces: translucent light panels with subtle borders; no excessive glass effects or floating decoration.
- Typography: the existing application font stack, with large but compact editorial headings and short readable line lengths.
- Imagery: reuse repository-owned threat photographs; use cover crops with meaningful alt text.
- Motion: 180–500 ms easing, small transform distances, no looping content motion, and no scroll hijacking.
- Responsive behaviour: desktop shows partial adjacent carousel cards; mobile shows one dominant card with the next card peeking in. Detail columns collapse into a single clear reading order.

## Components and data

Add a public `/reef-threats` route backed by a focused Epic 3 feature folder. Threat copy and image metadata live in a typed data module so the carousel, details, exercise, and reporting links share one source of truth. Interactive UI runs in a client component; route metadata and page composition remain server-side where possible.

The Reef Threat Explorer replaces the former learning page as the single public destination for threat recognition and responsible-reporting guidance.

## Accessibility and error handling

- Carousel controls have explicit labels and disabled states.
- Cards are real buttons and expose selected state with `aria-pressed`.
- The carousel remains usable with keyboard, touch, mouse, and assistive technology.
- Focus indicators remain visible against ocean and light surfaces.
- Reduced-motion users receive instant or near-instant state changes.
- Missing images fall back to a designed color surface and useful text without blocking exploration.
- Text contrast targets WCAG AA.

## Verification

Add component tests for initial content, threat selection, carousel controls, exercise feedback, uncertain reporting, and authenticated versus unauthenticated report links. Run lint, TypeScript checks, unit tests, and the production build. Verify the final page in a real browser at desktop and mobile sizes, including keyboard navigation and reduced-motion behaviour.
