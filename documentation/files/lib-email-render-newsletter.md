# File: `lib/email/render-newsletter.ts`

## Purpose
Renders final newsletter content into subject + HTML + plain text.

## Input
- `preferredName`
- `timezone`
- `runAtUtc`
- `items[]` (`title`, `summary`, `url`)

## Behavior
- builds date-aware subject (`Your daily brief for ...`)
- renders exactly the provided item list order
- includes safe greeting fallback when `preferredName` is empty
- includes minimal reply-calibration footer
