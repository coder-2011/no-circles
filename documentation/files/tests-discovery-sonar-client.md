# File: `tests/discovery-sonar-client.test.ts`

## Purpose
Unit coverage for Sonar client parsing and request contract.

## Coverage
- Parses strict `[TITLE] || URL` output format and ignores malformed lines.
- Deduplicates repeated URLs.
- Asserts request shape includes system-format contract and configured model/temperature.
- Throws on missing `PERPLEXITY_API_KEY`.
