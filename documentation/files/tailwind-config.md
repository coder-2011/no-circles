# File: `tailwind.config.ts`

## Purpose
Tailwind CSS configuration for content scanning, theme extensions, and plugins.

## Behavior
1. Scans `app/` and `components/` for class usage.
2. Enables class-based dark mode.
3. Extends design tokens via CSS-variable-backed colors and radii.
4. Loads `tailwindcss-animate` plugin.

## Why It Exists
- Centralizes design token mapping between Tailwind and global CSS variables.
- Ensures consistent utility generation and animation support.
