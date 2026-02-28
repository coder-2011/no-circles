# File: `lib/quotes/select-personalized-quote.ts`

## Purpose
Selects one personalized quote for a user and issue date.

## Input
- `userId`
- `localIssueDate`
- `interestMemoryText`
- optional `candidateCount` (default `50`)
- optional `shortlistCount` (default `20`)

## Behavior
1. Build deterministic seed from `userId + localIssueDate`.
2. Pull one batch from Hugging Face dataset server `/rows` for `jstet/quotes-500k`.
3. Normalize and pre-filter rows:
   - quote length bounds (`40..180` chars)
   - non-empty author
   - dedupe by quote+author
4. Build profile context from memory sections (`PERSONALITY`, `RECENT_FEEDBACK`).
5. Ask Claude to select one quote index via strict JSON output.
6. Return `{ text, author, category, sourceDataset, rowIndex }`.

## Fallbacks
- Hugging Face failure -> static local fallback quote.
- Claude failure/invalid output -> first shortlist quote.

## Notes
- Uses deterministic sampling to keep same-day retries stable.
- Does not maintain quote-repeat history in this initial version.
