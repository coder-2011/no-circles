# File: `app/onboarding/use-onboarding-controller.ts`

## Purpose
Encapsulates onboarding page state, side effects, and action handlers as a reusable controller hook.

## Responsibilities
- initialize and expose onboarding form state
- resolve auth/session status through Supabase browser client
- redirect signed-out users
- persist/remove local draft text in `localStorage`
- submit onboarding payload to `POST /api/onboarding`
- expose UX actions:
  - Google sign-in
  - sign-out
  - submit
  - quick-spark append
  - Wispr dictation start/stop for brain-dump voice input

## Notes
- `send_time_local` is derived from hour/minute/meridiem state via `buildSendTime`, avoiding redundant state syncing.
