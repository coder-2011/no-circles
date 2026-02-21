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
- assume a curious generalist reader (not a domain specialist)
- prefer medium sized concrete sentences over compressed abstract clauses
- split sentences when they carry 2+ technical nouns
- avoid meta framing (for example `this article explains`)
- require at least two concrete details; otherwise output `summary = INSUFFICIENT_SOURCE_DETAIL`
- ban counterfactual/future-projection framing unless explicitly present in highlights
- preserve original title by default; if edited, change at most 8 words and keep named entities
- return strict JSON only (`title`, `summary`)
