# File: `lib/sample-brief/parse-newsletter-text.ts`

## Purpose
Parses newsletter plain text into structured sample-brief content usable by the homepage UI.

## Output
- `items`: up to 10 entries with:
  - `title`
  - `url`
  - `summary`
- `quote`: optional `{ text, author }`

## Parsing Rules
- Reads numbered blocks (`1.`, `2.`, …) as candidate items.
- Pulls first URL line in each item block as canonical URL.
- Excludes feedback lines (`More like this`, `Less like this`) from summaries.
- Excludes `Serendipity pick` helper lines from summaries.
- Parses quote from:
  - `Quote of the Day:`
  - `"quoted text"`
  - `- author`

