# File: `app/page.tsx`

## Purpose
Landing/auth-entry client page for the product.

## Behavior
1. Initializes Supabase browser auth client.
2. Resolves session state (`loading`, `signed_in`, `signed_out`, `error`).
3. Uses a single `Get started` CTA that directly initiates Google OAuth and redirects through `/auth/callback`.
4. Supports local sign-out and hard refresh navigation back to `/`.

## Why It Exists
- Provides the single public entrypoint for authentication.
- Keeps onboarding protected while still letting users explicitly navigate to `/onboarding`.
