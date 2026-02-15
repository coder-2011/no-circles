# File: `app/auth/callback/route.ts`

## Purpose
Handles OAuth callback code exchange and writes Supabase session cookies for server-side auth.

## Request/Query Inputs
- `code` (OAuth authorization code from provider)
- `next` (optional path to redirect after successful exchange; default `/onboarding`)

## Behavior
1. Creates Supabase server client with request cookies.
2. Exchanges `code` for a session when present.
3. Redirects to `next` path on success.
4. Redirects to `/?auth=oauth_error` on code-exchange failure.
