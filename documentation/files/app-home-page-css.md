# File: `app/home-page.css`

## Purpose
Holds the landing-page-specific visual system for the home route.

## Behavior
1. Styles the `prototype-07` landing-page structure rendered by `app/page.tsx`.
2. Defines the page-local typography, spacing, glow backgrounds, top route navigation, homepage sections, and the open-layout `How It Works` page sections.
3. Styles the floating CTA, magnetic-button hover state, custom cursor ring, and trailing cursor ornaments.
4. Restores normal cursor behavior and removes cursor ornaments on coarse pointers.
5. Disables non-essential motion for reduced-motion users.

## Why It Exists
- Keeps the large prototype-specific stylesheet out of `app/globals.css`.
- Lets the landing page match the prototype closely without polluting unrelated routes.
