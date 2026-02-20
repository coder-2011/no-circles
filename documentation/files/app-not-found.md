# File: `app/not-found.tsx`

## Purpose
Defines the Next.js 404 surface for unknown routes.

## Behavior
- Renders required heading copy:
  - `Page not found`
  - `Look at this cool ascii art instead`
- Embeds `DwitterCanvas` with `sketchId="random"` so each 404 load can show a different sketch.
- Provides a direct `Back to home` link.

## Why This Exists
- Replaces default framework 404 with a branded error experience.
- Satisfies product request for playful rotating Dwitter-style visuals on missing routes.
