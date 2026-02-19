# File: `app/onboarding/onboarding-form.tsx`

## Purpose
Renders onboarding UI as a presentational component driven by controller props.

## Responsibilities
- display auth/session state banner and signed-out actions
- render onboarding form fields and quick-spark buttons
- render save/sign-out controls and success indicator
- show submit success/error message panel

## Input Contract
- receives `controller: OnboardingController` from `useOnboardingController`
- does not own business logic or side-effect orchestration
