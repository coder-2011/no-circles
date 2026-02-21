# File: `app/onboarding/use-onboarding-controller.ts`

## Purpose
Encapsulates onboarding page state, side effects, and action handlers as a reusable controller hook.

## Responsibilities
- initialize and expose onboarding form state
- derive persisted preferred name from signed-in OAuth profile metadata (`full_name`/`name`/`given_name`) with email local-part fallback
- resolve auth/session status through Supabase browser client
- redirect signed-out users
- persist/remove local draft text in `localStorage` (debounced writes to reduce typing/main-thread pressure)
- persist onboarding preference draft in `localStorage` (timezone/send-time parts)
- submit onboarding payload to `POST /api/onboarding`
- on successful save, clear onboarding drafts, keep user on onboarding page, show celebratory save state, and display near-term intro/first-email status copy
- auto-hide celebratory save state after a short timeout (`3400ms`)
- on `401` submit response, persist reauth-recovery flag, redirect to Google sign-in, and show draft-recovered message after session restore
- build OAuth redirect URL from current browser origin (`window.location.origin`) so localhost and production always stay on their active host
- include `callback_origin` query param in OAuth redirect URL so callback can explicitly preserve localhost final redirect in fallback-heavy environments
- derive no-permission local defaults:
  - timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - send time from current local clock
- expose UX actions:
  - Google sign-in
  - sign-out
  - submit
  - quick-spark append
  - quick-spark deck controls (`More/Hide`, `Refresh`)
  - Deepgram dictation start/stop for brain-dump voice input

## Notes
- `send_time_local` is derived from hour/minute/meridiem state via `buildSendTime`, avoiding redundant state syncing.
- auth bootstrap reads from Supabase `getSession()` for lower-latency client-side state initialization.
- Deepgram dictation helpers are lazy-imported on first dictation start, so onboarding initial bundle avoids loading audio/WebSocket transform utilities until needed.
- quick-sparks are loaded from `public/onboarding-quick-sparks.txt` and consumed from a persisted non-repeating deck (`unseen` -> `seen`) so refreshes avoid repeats until the pool is exhausted.
