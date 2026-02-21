# File: `app/page.tsx`

## Purpose
Landing/auth-entry client page for the product.

## Behavior
1. Initializes Supabase browser auth client once via lazy state initializer (avoids extra render/effect churn).
2. Resolves session state (`loading`, `signed_in`, `signed_out`, `error`) from Supabase `getSession()` for faster client-side auth hydration.
3. Uses a single `Get started` CTA that directly initiates Google OAuth and redirects through `/auth/callback`.
4. Supports local sign-out and client-side navigation back to `/`.
5. Uses wider responsive layout bounds and larger typography/button sizing so primary content occupies more of the viewport.
6. Renders a populated `Sample Daily Brief` section with ten realistic newsletter items (title + outbound link + neutral summary) generated from a diverse onboarding memory profile and used as static homepage exemplar content.

## Why It Exists
- Provides the single public entrypoint for authentication.
- Keeps onboarding protected while still letting users explicitly navigate to `/onboarding`.
- Shows prospective users concrete output quality before signup instead of placeholder annotations.
