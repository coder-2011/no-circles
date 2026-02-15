# File: `lib/utils.ts`

## Purpose
Shared utility helpers used across UI/components.

## Exports
- `cn(...inputs)`: merges conditional class names using `clsx` + `tailwind-merge`.

## Why It Exists
- Prevents duplicate class-merging logic across components.
- Aligns with shadcn utility pattern used by generated/handwritten UI modules.
