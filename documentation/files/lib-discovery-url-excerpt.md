# File: `lib/discovery/url-excerpt.ts`

## Purpose
Provides low-cost local URL text extraction plus page snapshots for discovery ranking and paywall analysis.

## Behavior
1. Fetches URL HTML with timeout and bot user-agent.
2. Follows redirects and preserves final response metadata.
3. Rejects non-HTML bodies for excerpt purposes but still exposes status/content-type in snapshot mode.
4. Strips scripts/styles/noscript/svg and removes tags.
5. Prefers `<article>` block when present.
6. Normalizes whitespace and decodes common HTML entities.
7. Returns clipped excerpt (default 1500 chars) or `null` when extraction is too weak/fails.
8. Exposes `fetchUrlSnapshot(...)` so discovery can reuse one fetch for both excerpt gating and paywall heuristics.

## Usage
- Discovery stage uses this when `requireUrlExcerpt` is enabled.
- Candidates with `null` excerpt are dropped.
- Discovery paywall filtering reuses snapshot mode so the page HTML is not fetched twice.
