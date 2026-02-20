# File: `components/dwitter-canvas.tsx`

## Purpose
Client-side canvas renderer for Dwitter-style sketch animations.

## Behavior
- Accepts `sketchId` or `random`.
- Resolves random id on mount when `sketchId="random"`.
- Resizes canvas to container and runs animation loop via `requestAnimationFrame`.
- Draws selected sketch using registry helpers from `lib/art/dwitter-sketches.ts`.

## Notes
- Displays sketch id/title and route hints for manual testing.
