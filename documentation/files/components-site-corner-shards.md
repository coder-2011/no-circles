# File: `components/site-corner-shards.tsx`

## Purpose
Adds a fixed top-right decorative chrome motif across the entire site.

## Responsibilities
- render a non-interactive sharp-edged corner structure that echoes the logo and existing angular cursor language
- stay mounted from the global layout so every page gets the same top-right visual treatment
- keep the shape purely decorative and independent from page content flow

## Notes
- the visual system for the shards lives in `app/globals.css`
- this component intentionally contains only structure, not styling logic
