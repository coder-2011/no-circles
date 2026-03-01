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
7. Renders the landing page in the `prototype-07-streamlined-scroll` structure: top navigation, hero, overview, public flow steps, sample brief, and pricing-warning copy.
8. Reuses the current auth handlers on both CTA buttons so the visual prototype remains wired to real sign-in and signed-in onboarding continuation.
9. Hydrates the `Today's Brief` section from `GET /api/sample-brief` (latest `daily` sent brief text for the fixed source account) and falls back to a static 4-item exemplar when API data is unavailable.
10. Shows the current date in the sample-brief header.
11. Mounts the shared `components/site-cursor.tsx` custom cursor on the homepage while keeping page-specific magnetic CTA behavior.
12. Pins a floating top-right auth CTA while scrolling so users can trigger `Get started` without returning to the hero section.
13. Uses `app/home-page-content.ts` for fallback sample-brief content and `app/home-page-nav.tsx` for the shared top navigation so the page file stays more focused on auth and homepage behavior.

## Why It Exists
- Provides the single public entrypoint for authentication.
- Keeps onboarding protected while still letting users explicitly navigate to `/onboarding`.
- Shows prospective users concrete output quality before signup instead of placeholder annotations.
- Keeps the main homepage focused on product value and sample output while the longer system explainer lives on its own route.
