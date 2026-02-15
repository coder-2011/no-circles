# File: `lib/auth/browser-client.ts`

## Purpose
Provides a singleton Supabase browser client for frontend auth flows.

## Behavior
1. Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Creates one browser client instance.
3. Reuses the same instance across client renders.

## Failure Contract
- Throws when required Supabase env vars are missing.
