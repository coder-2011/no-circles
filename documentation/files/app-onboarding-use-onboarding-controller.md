# File: `app/onboarding/use-onboarding-controller.ts`

## Purpose
Encapsulates onboarding page state, side effects, and action handlers as a reusable controller hook.

## Responsibilities
- initialize and expose onboarding form state
- derive preferred-name suggestion from signed-in email when local-part clearly matches first/last pattern; otherwise fall back to curated famous-name placeholder
- resolve auth/session status through Supabase browser client
- redirect signed-out users
- persist/remove local draft text in `localStorage` (debounced writes to reduce typing/main-thread pressure)
- persist onboarding preference draft in `localStorage` (preferred name/timezone/send-time parts)
- submit onboarding payload to `POST /api/onboarding`
- on `401` submit response, persist reauth-recovery flag, redirect to Google sign-in, and show draft-recovered message after session restore
- build OAuth redirect URL with localhost-first origin resolution so local development does not bounce to production when `NEXT_PUBLIC_SITE_URL` is set
- derive no-permission local defaults:
  - timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - send time from current local clock
- expose UX actions:
  - Google sign-in
  - sign-out
  - submit
  - quick-spark append
  - quick-spark deck controls (`More/Hide`, `Refresh`)
  - preferred-name Tab completion toward current suggestion
  - Deepgram dictation start/stop for brain-dump voice input

## Notes
- `send_time_local` is derived from hour/minute/meridiem state via `buildSendTime`, avoiding redundant state syncing.
- auth bootstrap reads from Supabase `getSession()` for lower-latency client-side state initialization.
- Deepgram dictation helpers are lazy-imported on first dictation start, so onboarding initial bundle avoids loading audio/WebSocket transform utilities until needed.
- quick-sparks are loaded from `public/onboarding-quick-sparks.txt` and consumed from a persisted non-repeating deck (`unseen` -> `seen`) so refreshes avoid repeats until the pool is exhausted.
