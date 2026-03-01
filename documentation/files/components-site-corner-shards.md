# File: `components/site-corner-shards.tsx`

## Purpose
Adds a fixed geometric line-field across the entire site background.

## Responsibilities
- render a non-interactive geometric SVG motif that echoes the logo/reference line language
- render a single full-viewport network of long connected stepped lines across the site background
- stay mounted from the global layout so every page gets the same background treatment
- keep the shape purely decorative and independent from page content flow

## Notes
- the visual system for the shards lives in `app/globals.css`
- the current version prioritizes a small number of long connected paths so the linework feels continuous across the page
