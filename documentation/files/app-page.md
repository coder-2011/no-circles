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
8. Presents clear above-the-fold product messaging in a styled hero copy box focused on un-googleable discovery: ten high-signal niche long-form reads each morning plus a principle statement about unexpected ideas.
9. Hydrates `Sample Daily Brief` content from `GET /api/sample-brief` (latest sent brief text for fixed source account) and falls back to static exemplar content when API data is unavailable.
10. Shows the current date in the sample-brief header (top-right) while preserving existing homepage formatting.
11. Shows a pricing notice directly below the sample brief clarifying free access through mid-March and planned minimal at-cost billing afterward (no profit margin), including monthly per-user usage tiers: lean `~$2.54`, base `~$3.89`, heavy `~$5.57`.
12. Pins a floating top-right auth CTA while scrolling so users can trigger `Get started` (or `Continue onboarding` when signed in) without returning to the hero section.

## Why It Exists
- Provides the single public entrypoint for authentication.
- Keeps onboarding protected while still letting users explicitly navigate to `/onboarding`.
- Shows prospective users concrete output quality before signup instead of placeholder annotations.
