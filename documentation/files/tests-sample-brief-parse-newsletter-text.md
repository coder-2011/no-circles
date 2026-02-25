# File: `tests/sample-brief-parse-newsletter-text.test.ts`

## Purpose
Validates sample-brief text parsing behavior for homepage content hydration.

## Coverage
- Extracts numbered item blocks into `title/url/summary`.
- Removes feedback action lines from summary output.
- Parses quote text + author when present.
- Returns empty output safely for non-newsletter inputs.

