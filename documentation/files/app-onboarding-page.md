# File: `app/onboarding/page.tsx`

## Purpose
Frontend onboarding entrypoint that composes controller + presentational form.

## Behavior
1. Creates onboarding controller via `useOnboardingController`.
2. Mounts the shared `components/site-cursor.tsx` custom cursor so onboarding matches homepage pointer treatment on fine pointers.
3. Renders `OnboardingForm` with controller props.
4. Keeps route-level ownership minimal while logic/UI concerns live in dedicated files.

## Related Files
- `components/site-cursor.tsx`
- `app/onboarding/use-onboarding-controller.ts`
- `app/onboarding/onboarding-form.tsx`
- `app/onboarding/onboarding-config.ts`
