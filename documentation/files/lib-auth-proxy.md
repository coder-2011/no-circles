# File: `lib/auth/proxy.ts`

## Purpose
Provides the request-time Supabase auth refresh helper used by Next.js `proxy.ts`.

## Behavior
1. Reads Supabase public env vars.
2. Creates a Supabase server client bound to the incoming `NextRequest`.
3. Keeps request cookies and response cookies synchronized when Supabase refreshes auth state.
4. Calls `supabase.auth.getUser()` so later server-side auth reads see fresh cookies.
5. Returns the updated `NextResponse`.

## Notes
- If Supabase env vars are missing, the helper falls back to `NextResponse.next()` instead of breaking every request globally.
- This file follows Supabase's recommended Next.js SSR auth-refresh pattern without duplicating cookie-sync logic in `proxy.ts`.
