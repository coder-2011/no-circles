# File: `app/onboarding/page.tsx`

## Purpose
Frontend onboarding entrypoint that composes controller + presentational form.

## Behavior
1. Creates onboarding controller via `useOnboardingController`.
2. Renders `OnboardingForm` with controller props.
3. Keeps route-level ownership minimal while logic/UI concerns live in dedicated files.

## Related Files
- `app/onboarding/use-onboarding-controller.ts`
- `app/onboarding/onboarding-form.tsx`
- `app/onboarding/onboarding-config.ts`
