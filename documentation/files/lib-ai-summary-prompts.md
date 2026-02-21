# File: `lib/ai/summary-prompts.ts`

## Purpose
Builds deterministic per-item summary prompts for PR8.

## Export
- `buildSummaryPrompt(args)`

## Contract
Input fields:
- `title`
- `url`
- `highlights[]`
- optional `topic`
- `minWords`, `maxWords`

Output:
- one prompt string that instructs model to return JSON with exactly:
  - `title`
  - `summary`

## Prompt Policy
- neutral, factual, and source-grounded
- treat highlights as the only evidence source
- no speculation, hype, or invented detail
- avoid meta framing (for example `this article explains`)
- if highlights lack concrete detail, output `summary = INSUFFICIENT_SOURCE_DETAIL`
- preserve original title by default; only minimal clarity edits when necessary
- return strict JSON only (`title`, `summary`)
