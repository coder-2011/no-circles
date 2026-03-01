# File: `app/globals.css`

## Purpose
Global style entrypoint for Tailwind layers and theme CSS variables.

## Behavior
1. Loads Tailwind `base`, `components`, and `utilities`.
2. Defines shared color and radius CSS custom properties for light/dark tokens.
3. Defines shared custom-cursor styles (`.site-cursor*`) and the `body.site-cursor-active` native-cursor suppression rule for fine-pointer pages that mount `components/site-cursor.tsx`.
4. Applies global body defaults and border/text utility wiring in `@layer base`.

## Why It Exists
- Provides one canonical styling foundation for shadcn/Tailwind-driven UI.
- Keeps design tokens centralized instead of duplicated in components.
- Holds the shared cursor styling so homepage and onboarding use the same pointer treatment.
