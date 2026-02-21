# File: `lib/email/render-newsletter.ts`

## Purpose
Renders final newsletter content into subject + HTML + plain text.

## Input
- `preferredName`
- `timezone`
- `runAtUtc`
- `items[]` (`title`, `summary`, `url`)
- optional `variant` (`daily` | `welcome`)

## Behavior
- builds date-aware daily subject (`Your daily brief for ...`) or welcome subject (`Welcome to No Circles - your first issue`)
- renders exactly the provided item list order
- renders each item as a bordered card and keeps title as clickable hyperlink to the item URL
- applies the same earthy brand palette/typography direction used on homepage sample surfaces
- includes safe greeting fallback when `preferredName` is empty
- includes variant-specific intro/footer copy (welcome vs daily)
