# Subsystem: Summary Generation (PR8)

## Scope
Implements PR8 newsletter-item summary generation from discovery output.

## In Scope
- Consume discovery candidates as input (`url`, `title`, `highlights`, optional `topic`)
- Generate one summary per item using Claude Haiku 4.5 (`ANTHROPIC_SUMMARY_MODEL` when set, otherwise `ANTHROPIC_MEMORY_MODEL`)
- Single model call per item with one retry max
- Output final item contract only: `{ title, url, summary }`
- Enforce fixed URL passthrough from source candidate
- Apply soft word-range targeting (default target 100 words, default range 80-120)
- Use `PERSONALITY` from user memory as editorial calibration for depth/tone while keeping the default reader assumption as curious generalist

## Out of Scope
- Discovery/ranking changes (PR6)
- Content fetching/extraction changes (PR7)
- Email rendering/send/persistence changes (PR9)

## Runtime Contract
Input:
- per-item fields from discovery candidate subset:
  - `url`
  - `title`
  - `highlights`
  - `topic` (optional)
- optional `interestMemoryText` so the writer can read `PERSONALITY`

Output:
- `NewsletterSummaryItem[]`:
  - `title`
  - `url`
  - `summary`

## Reliability Rules
- URL is always copied from input; model output never controls URL.
- Model output must validate against `summaryWriterOutputSchema` (`title`, `summary`).
- Placeholder/non-informative model summaries are rejected and treated as invalid output.
- `INSUFFICIENT_SOURCE_DETAIL` is treated as terminal quality failure and the item is dropped.
- Other non-quality model failures are retried once; if still invalid, the item is dropped.
- No deterministic highlight-to-summary fallback is used in strict mode.
- If highlights are missing/too weak, the item is skipped so low-signal summaries are not emitted; upstream pipeline handles reduced item count as `insufficient_content`.

## Tone and Editorial Rules
- Neutral, factual, source-grounded.
- Mild connective phrasing allowed.
- No speculative claims beyond provided highlights.
- Summaries should cover core concepts/mechanisms/findings from highlights, not only meta high-level framing.
- Default reader assumption stays `curious generalist`.
- `PERSONALITY` can locally tune depth, jargon tolerance, and framing, including topic-scoped preferences when the current item clearly matches them.
