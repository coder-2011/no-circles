# File: `lib/summary/writer.ts`

## Purpose
Generates final newsletter summary items for PR8 from discovery candidate inputs.

## Export
- `generateNewsletterSummaries(input)`

## Input Contract
- `items[]` with:
  - `url`
  - `title`
  - `highlights[]`
  - optional `topic`
  - optional `isSerendipitous` (pass-through lane metadata from discovery/pipeline)
- optional word controls:
  - `targetWords` (default 100)
  - or explicit `minWords` / `maxWords`

Default word range when only target is provided:
- `targetWords - 20` to `targetWords + 20` (default `80-120`)

## Output Contract
- `NewsletterSummaryItem[]` with final fields only:
  - `title`
  - `url`
  - `summary`
  - optional `isSerendipitous` (present only when true in source item)

## Behavior
1. For each item, call Anthropic Messages API once per attempt.
2. Parse model text as JSON (`title`, `summary`).
3. Validate with `summaryWriterOutputSchema`.
4. Clamp summary into configured word range.
   - For overlong summaries, trims at sentence boundary when possible.
   - Does not inject filler sentence padding for short outputs.
5. Keep URL fixed from source item regardless of model output.
6. Retry invalid/unavailable model output once.
7. Treat placeholder/non-informative outputs (for example `Unable to generate summary...`) as invalid output.
8. If still invalid, use deterministic highlight-based fallback only when highlight detail is sufficient.
9. If highlights are missing or fallback detail is inadequate, skip the item entirely so low-signal summaries are never emitted.
10. Emit structured logs:
   - per-item fallback event (`summary_fallback_used`)
   - per-item skip events (`summary_skipped_missing_highlights`, `summary_skipped_insufficient_highlights`)
   - per-run counts (`summary_run_complete` with `fallback_count`)

## Environment
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_SUMMARY_MODEL` (optional override)
- `ANTHROPIC_MEMORY_MODEL` (default model when summary override is unset)
