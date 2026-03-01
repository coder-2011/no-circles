# File: `app/onboarding/onboarding-form.tsx`

## Purpose
Renders onboarding UI as a presentational component driven by controller props.

## Responsibilities
- display auth/session state banner and signed-out actions
- render onboarding form fields and compact quick-spark surface
- show top quick-spark chips by default, with a quirky expand/collapse "spark stash" toggle below the chips and a refresh-icon control above them
- keep expanded spark list compact via a taller fixed-height scroll container and append more sparks as the user scrolls near the bottom
- omit manual preferred-name editing in UI (controller submits OAuth/session-derived preferred name)
- render timezone options from controller so browser-detected timezone can appear even when outside curated list
- render minimal dictation controls (`Dictate` / `Stop dictation`) for brain-dump voice input
- keep textarea focus when toggling dictation so users can continue typing during active recording
- trigger optimistic dictation warmup from high-intent events (brain-dump textarea focus, dictation-button focus/hover/press)
- show larger brain-dump guidance text and intentionally no example placeholder text
- autofocus the brain-dump textarea on load
- render save/sign-out controls, save badge, and lightweight slower-fall confetti celebration (multi-color particle variation) when onboarding save succeeds
- render post-save pricing callout box below controls clarifying free access through mid-March and later minimal at-cost billing; current copy still reflects historical monthly estimates and should stay aligned with `documentation/appendix/pricing-and-unit-economics.md`
- show submit success/error message panel

## Input Contract
- receives `controller: OnboardingController` from `useOnboardingController`
- does not own business logic or side-effect orchestration
