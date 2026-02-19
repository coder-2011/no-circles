# File: `app/[art]/page.tsx`

## Purpose
Provides test routes for Dwitter-style art variants at:
- `/1` through `/9`
- `/random`

## Behavior
- Validates route segment against known sketch ids plus `random`.
- Unknown ids call `notFound()`.
- Reuses the same 404-themed layout copy and embeds `DwitterCanvas`.
- Supports manual QA of each sketch by direct URL.
