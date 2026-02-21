# File: `app/auth/callback/route.ts`

## Purpose
Handles OAuth callback code exchange and writes Supabase session cookies for server-side auth.

## Request/Query Inputs
- `code` (OAuth authorization code from provider)
- `next` (optional path to redirect after successful exchange; default `/onboarding`)
- `callback_origin` (optional explicit callback origin; honored only for localhost/127.0.0.1/::1 origins)

## Behavior
1. Creates Supabase server client with request cookies.
2. Exchanges `code` for a session when present.
3. Resolves redirect origin from request context with environment guard:
   - if `callback_origin` is provided and is a localhost-origin, use it as highest-priority redirect origin
   - localhost request URLs (`localhost`/`127.0.0.1`/`::1`) always use request origin, even in production mode
   - non-production: otherwise always uses request origin (`request.url`) to prevent proxy/header drift in local dev
   - production: uses forwarded host/proto when present, else request origin
4. Redirects to `next` path on success.
5. Redirects to `/?auth=oauth_error` on code-exchange failure.
