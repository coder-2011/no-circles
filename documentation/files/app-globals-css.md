# File: `app/globals.css`

## Purpose
Global style entrypoint for Tailwind layers and theme CSS variables.

## Behavior
1. Loads Tailwind `base`, `components`, and `utilities`.
2. Defines shared color and radius CSS custom properties for light/dark tokens.
3. Applies global body defaults and border/text utility wiring in `@layer base`.

## Why It Exists
- Provides one canonical styling foundation for shadcn/Tailwind-driven UI.
- Keeps design tokens centralized instead of duplicated in components.
