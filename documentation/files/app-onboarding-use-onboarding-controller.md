# File: `app/onboarding/use-onboarding-controller.ts`

## Purpose
Encapsulates onboarding page state, side effects, and action handlers as a reusable controller hook.

## Responsibilities
- initialize and expose onboarding form state
- derive preferred-name suggestion from signed-in email when local-part clearly matches first/last pattern; otherwise fall back to curated famous-name placeholder
- resolve auth/session status through Supabase browser client
- redirect signed-out users
- persist/remove local draft text in `localStorage`
- submit onboarding payload to `POST /api/onboarding`
- derive no-permission local defaults:
  - timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - send time from current local clock
- expose UX actions:
  - Google sign-in
  - sign-out
  - submit
  - quick-spark append
  - preferred-name Tab completion toward current suggestion
  - Deepgram dictation start/stop for brain-dump voice input

## Notes
- `send_time_local` is derived from hour/minute/meridiem state via `buildSendTime`, avoiding redundant state syncing.
