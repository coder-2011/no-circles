# File: `lib/discovery/url-excerpt.ts`

## Purpose
Provides low-cost local URL text extraction for discovery ranking.

## Behavior
1. Fetches URL HTML with timeout and bot user-agent.
2. Rejects non-HTML responses.
3. Strips scripts/styles/noscript/svg and removes tags.
4. Prefers `<article>` block when present.
5. Normalizes whitespace and decodes common HTML entities.
6. Returns clipped excerpt (default 1500 chars) or `null` when extraction is too weak/fails.

## Usage
- Discovery stage uses this when `requireUrlExcerpt` is enabled.
- Candidates with `null` excerpt are dropped.
