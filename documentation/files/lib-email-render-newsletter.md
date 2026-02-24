# File: `lib/email/render-newsletter.ts`

## Purpose
Renders final newsletter content into subject + HTML + plain text from curated email theme templates.

## Input
- `preferredName`
- `timezone`
- `runAtUtc`
- `items[]` (`title`, `summary`, `url`, optional `isSerendipitous`)
- optional `quote` (`text`, `author`, `category`)
- optional `variant` (`daily` | `welcome`)
- optional `feedbackLinksByItemUrl` map keyed by item URL (`moreLikeThisUrl`, `lessLikeThisUrl`)
- optional `themeTemplate` (one of the curated template ids, for example `01-riviera-sun`)

## Behavior
- builds date-aware daily subject (`Your daily brief for ...`) or welcome subject (`Welcome to No Circles - your first issue`)
- renders exactly the provided item list order
- renders each item as a bordered card and keeps title as clickable hyperlink to the item URL
- when `isSerendipitous` is true, renders a small inline note indicating the item is a serendipity/new-territory pick
- when `quote` is provided, renders an inline `Quote of the Day` section directly above the reply-adaptation footer line in both HTML and plain text outputs
- when feedback links are provided, renders per-item in-email actions (`More like this`, `Less like this`) in HTML and includes equivalent link lines in plain text output
- uses tokenized colors from a curated 10-template registry (`NEWSLETTER_THEME_TEMPLATES`) so every email is a real template, not ad hoc inline color changes
- defaults to a safe baseline template when no template is provided
- exports `getNewsletterThemeTemplateKeys()` and `pickRandomNewsletterThemeTemplate()` so runtime pipelines can select templates explicitly
- includes safe greeting fallback when `preferredName` is empty
- `welcome` variant uses the same selected template system but keeps copy concise (`Here is your first issue with X curated links`) so the separate onboarding intro email owns the developer note
