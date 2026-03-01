# File: `app/how-it-works/page.tsx`

## Purpose
Dedicated public page explaining how No-Circles works without forcing that explanation into the main homepage flow.

## Behavior
1. Renders the shared top navigation with `How It Works` as the active tab.
2. Reuses the homepage visual shell and cursor treatment so the route still feels like part of the same site.
3. Pulls longer, user-facing explanatory copy from `app/home-page-content.ts`.
4. Renders the behind-the-scenes explanation as an open page with stacked sections instead of a boxed homepage card.
5. Includes a return path back to `/`.

## Why It Exists
- Gives the legitimacy/trust explanation its own space.
- Keeps the default homepage focused on conversion and sample output.
