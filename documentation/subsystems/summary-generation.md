# Subsystem: Summary Generation (PR8)

## Scope
Implements PR8 newsletter-item summary generation from discovery output.

## In Scope
- Consume discovery candidates as input (`url`, `title`, `highlights`, optional `topic`)
- Generate one summary per item using the shared Anthropic-compatible model transport with OpenRouter-first model selection (`OPENROUTER_SUMMARY_MODEL`, then `OPENROUTER_MEMORY_MODEL`, then Anthropic fallbacks)
- Single model call per item with one retry max
- Output final item contract only: `{ title, url, summary }`
- Enforce fixed URL passthrough from source candidate
- Apply soft word-range targeting (default target 75 words, default range 55-95)
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
- Clarity outranks compression: summaries should explain the main idea coherently rather than trying to cover every available detail.
- Summaries should cover the core concepts/mechanisms/findings from highlights, not only meta high-level framing.
- The writer should choose the `2-4` concrete details that best make the article understandable.
- Simple, direct language is preferred when it can preserve the substance.
- The prompt encourages explanatory prose over fact-dense sentence packing and avoids note-like/list-like writing.
- Default reader assumption stays `curious generalist`.
- `PERSONALITY` can locally tune depth, jargon tolerance, and framing, including topic-scoped preferences when the current item clearly matches them.
