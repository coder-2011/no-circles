# File: `app/onboarding/onboarding-form.tsx`

## Purpose
Renders onboarding UI as a presentational component driven by controller props.

## Responsibilities
- display auth/session state banner and signed-out actions
- render onboarding form fields and compact quick-spark surface
- show top quick-spark chips by default, with `More/Hide` drawer toggle and refresh-icon control
- keep expanded spark list compact via fixed-height scroll container (avoids vertical page growth)
- wire preferred-name input to Tab completion action from the controller
- render timezone options from controller so browser-detected timezone can appear even when outside curated list
- render minimal dictation controls (`Dictate` / `Stop dictation`) for brain-dump voice input
- render save/sign-out controls and success indicator
- render post-save pricing callout box below controls clarifying free access through mid-March and later minimal at-cost billing (no profit margin)
- show submit success/error message panel

## Input Contract
- receives `controller: OnboardingController` from `useOnboardingController`
- does not own business logic or side-effect orchestration
