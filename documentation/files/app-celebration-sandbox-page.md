# File: `app/celebration-sandbox/page.tsx`

## Purpose
Temporary isolated page to validate the onboarding save celebration animation without the rest of the onboarding UI.

## Behavior
1. Reuses the same confetti particle config as onboarding.
2. Reuses the same `Saved` badge styling/transition as onboarding.
3. Reuses the same celebration lifetime (`2400ms`) as onboarding.
4. Triggers celebration from any of three sample buttons for quick visual testing.

## Notes
- This page is intentionally sandbox-only and not part of normal product flow.
- Route path: `/celebration-sandbox`.
