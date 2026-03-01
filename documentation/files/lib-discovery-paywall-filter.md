# File: `lib/discovery/paywall-filter.ts`

## Purpose
Scores discovery candidates for likely paywall risk using layered URL, domain, markup, and content heuristics.

## Behavior
1. Starts with the domain prior from `lib/discovery/paywall-domain-corpus.ts`.
2. Adds high-confidence URL path hints such as `/subscribe` or `/premium`.
3. Detects explicit paywall structured data from JSON-LD (`isAccessibleForFree=false`, `WebPageElement` selectors).
4. Looks for known paywall vendors and common paywall markup/copy patterns in fetched HTML.
5. Uses short paywall-copy-heavy excerpts as an extra weak signal.
6. Produces:
   - total score
   - machine-readable reasons
   - final `blocked` decision
7. Exposes a lightweight pre-filter for search results before full excerpt/page analysis.

## Notes
- The block threshold is intentionally conservative so BPC domain membership alone does not automatically drop mixed-access publishers.
- Page-level evidence is expected to carry most of the weight for final blocking decisions.
