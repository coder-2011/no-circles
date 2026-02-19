# File: `lib/art/dwitter-sketches.ts`

## Purpose
Holds the Dwitter-style sketch registry and draw logic.

## Contents
- `DITTER_SKETCHES`: list of all implemented sketches (`1`-`9`).
- `DITTER_SKETCH_IDS`: id list for routing and validation.
- `getDwitterSketchById(id)`: lookup helper.
- `getRandomDwitterSketchId()`: random selector helper.

## Implementation Notes
- Each sketch is implemented directly from provided Dwitter snippets with safety guards for `t` divisions.
- Rendering is normalized to canvas size using reference-space scale helpers so visuals stay visible across container sizes.
