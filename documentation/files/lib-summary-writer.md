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
- optional word controls:
  - `targetWords` (default 50)
  - or explicit `minWords` / `maxWords`

Default word range when only target is provided:
- `targetWords - 10` to `targetWords + 10`

## Output Contract
- `NewsletterSummaryItem[]` with final fields only:
  - `title`
  - `url`
  - `summary`

## Behavior
1. For each item, call Anthropic Messages API once per attempt.
2. Parse model text as JSON (`title`, `summary`).
3. Validate with `summaryWriterOutputSchema`.
4. Clamp/pad summary into configured word range.
5. Keep URL fixed from source item regardless of model output.
6. Retry invalid/unavailable model output once.
7. If still invalid, use deterministic highlight-based fallback summary.
8. Emit structured logs:
   - per-item fallback event (`summary_fallback_used`)
   - per-run counts (`summary_run_complete` with `fallback_count`)

## Environment
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_SUMMARY_MODEL` (optional override)
- `ANTHROPIC_MEMORY_MODEL` (default model when summary override is unset)
