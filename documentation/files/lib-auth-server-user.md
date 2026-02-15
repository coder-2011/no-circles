# File: `lib/auth/server-user.ts`

## Purpose
Resolves authenticated user identity for backend route handlers via Supabase SSR session APIs.

## Behavior
1. Reads required Supabase environment variables.
2. Creates server Supabase client with Next.js request cookies.
3. Calls `supabase.auth.getUser()`.
4. Returns authenticated email when available; returns `null` when session is missing/invalid.

## Failure Contract
- Missing Supabase env vars throws, so callers can map it to `500 INTERNAL_ERROR`.
