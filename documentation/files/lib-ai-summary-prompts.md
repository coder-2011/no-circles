# File: `lib/ai/summary-prompts.ts`

## Purpose
Builds deterministic per-item summary prompts for PR8.

## Export
- `SUMMARY_SYSTEM_PROMPT`
- `buildSummaryPrompt(args)`

## Contract
System role:
- `seasoned research editor`

Input fields:
- `title`
- `url`
- `highlights[]`
- optional `topic`
- optional `personalitySection`
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
- use `PERSONALITY` only to calibrate depth, jargon tolerance, tone, and framing
- allow topic-scoped personality lines to act as narrow overrides only when they match the current item
- prefer medium sized concrete sentences over compressed abstract clauses
- split sentences when they carry 2+ technical nouns
- avoid meta framing (for example `this article explains`)
- require at least two concrete details; otherwise output `summary = INSUFFICIENT_SOURCE_DETAIL`
- ban counterfactual/future-projection framing unless explicitly present in highlights
- preserve original title by default; if edited, change at most 8 words and keep named entities
- return strict JSON only (`title`, `summary`)
