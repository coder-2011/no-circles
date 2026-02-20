# File: `lib/discovery/exa-contents.ts`

## Purpose
Fetches final-stage Exa highlights for known winner URLs before summary generation.

## Behavior
- Requires `EXA_API_KEY`.
- Uses `exa.getContents(urls, { highlights: { maxCharacters } })`.
- Default max highlight characters: `4500` (override with `EXA_FINAL_HIGHLIGHT_MAX_CHARACTERS`).
- Returns `Map<canonicalUrl, highlights[]>` for pipeline lookup.
- Filters out empty highlight payloads.
