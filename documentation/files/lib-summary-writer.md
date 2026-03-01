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
- optional `interestMemoryText` (used to pass `PERSONALITY` style/depth context into the summary prompt)
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
1. For each item, call the shared Anthropic-compatible text-model client once per attempt.
2. Parse model text as JSON (`title`, `summary`).
3. Validate with `summaryWriterOutputSchema`.
4. Clamp summary into configured word range.
   - For overlong summaries, trims at sentence boundary when possible.
   - Does not inject filler sentence padding for short outputs.
5. Keep URL fixed from source item regardless of model output.
6. Retry non-quality model failures once (for example transport/schema/parse failures).
7. Treat quality failures as terminal and skip item immediately:
   - `summary = INSUFFICIENT_SOURCE_DETAIL`
   - placeholder/non-informative outputs (for example `Unable to generate summary...`)
   - empty summary after normalization
8. Do **not** generate deterministic fallback summary text from highlights.
9. If highlights are missing or model output fails quality checks, skip the item so low-signal summaries are never emitted.
10. When `interestMemoryText` is provided, parse `PERSONALITY` and pass it into the summary prompt so writing depth/tone can adapt without changing factual grounding.
11. Emit structured logs:
   - per-item skip events (`summary_skipped_missing_highlights`, `summary_skipped_after_model_failure`)
   - per-run counts (`summary_run_complete` with `skipped_count`)

## Environment
- provider auth:
  - `OPENROUTER_API_KEY` (preferred)
  - `ANTHROPIC_API_KEY` (fallback)
- model selection:
  - `OPENROUTER_SUMMARY_MODEL` (preferred override)
  - `OPENROUTER_MEMORY_MODEL`
  - `ANTHROPIC_SUMMARY_MODEL`
  - `ANTHROPIC_MEMORY_MODEL`
