# File: `app/home-page-nav.tsx`

## Purpose
Renders the top-level public navigation between the homepage and the dedicated `How It Works` page.

## Behavior
1. Accepts an `activeTab` prop (`home` or `how-it-works`).
2. Renders top navigation links to `/` and `/how-it-works`.
3. Marks the active destination with `aria-current="page"` and an active visual state.

## Why It Exists
- Keeps the public top navigation consistent across both public-facing pages.
- Replaces the earlier in-page state toggle with real route navigation.
