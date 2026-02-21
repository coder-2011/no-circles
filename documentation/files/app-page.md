# File: `app/page.tsx`

## Purpose
Landing/auth-entry client page for the product.

## Behavior
1. Initializes Supabase browser auth client once via lazy state initializer (avoids extra render/effect churn).
2. Resolves session state (`loading`, `signed_in`, `signed_out`, `error`) from Supabase `getSession()` for faster client-side auth hydration.
3. Uses a single `Get started` CTA that directly initiates Google OAuth and redirects through `/auth/callback`.
4. Resolves OAuth redirect origin from current browser host (`window.location.origin`) so local and production sign-in flows stay on the active origin.
5. Adds `callback_origin` query param to OAuth redirect URL using active browser origin; callback route can use this localhost-only override to avoid accidental fallback to production onboarding during local development.
6. Supports local sign-out and client-side navigation back to `/`.
7. Uses wider responsive layout bounds and larger typography/button sizing so primary content occupies more of the viewport.
8. Renders a populated `Sample Daily Brief` section with ten realistic newsletter items (title + outbound link + neutral summary) as a static, curated exemplar.
9. Shows a pricing notice in the top hero section directly under the auth CTA/status area, clarifying free access through mid-March and planned minimal at-cost billing afterward (no profit margin).

## Why It Exists
- Provides the single public entrypoint for authentication.
- Keeps onboarding protected while still letting users explicitly navigate to `/onboarding`.
- Shows prospective users concrete output quality before signup instead of placeholder annotations.
