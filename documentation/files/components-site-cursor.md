# File: `components/site-cursor.tsx`

## Purpose
Provides the shared custom cursor and trailing cursor ornaments for fine-pointer surfaces.

## Behavior
1. Detects whether the current device supports a fine hover pointer.
2. Adds/removes `body.site-cursor-active` so the native cursor is hidden only while the shared custom cursor is active.
3. Tracks mouse movement and renders a smoothed diamond cursor.
4. Enlarges the cursor over interactive targets (`a`, `button`, form controls, labels, and explicit button roles).
5. Renders trailing ornaments unless `prefers-reduced-motion: reduce` is enabled.

## Why It Exists
- Keeps cursor behavior consistent between the homepage and onboarding.
- Prevents the native cursor from sitting visibly on top of the custom cursor.
- Centralizes pointer-surface behavior instead of duplicating cursor logic in page components.
