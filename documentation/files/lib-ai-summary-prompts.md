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
- clarity outranks compression
- explain the core idea coherently instead of merely restating highlights
- prefer understanding over maximum detail coverage
- treat highlights as the only evidence source
- no speculation, hype, or invented detail
- assume a curious generalist reader (not a domain specialist)
- use `PERSONALITY` only to calibrate depth, jargon tolerance, tone, and framing
- allow topic-scoped personality lines to act as narrow overrides only when they match the current item
- include `2-4` concrete details that best explain the core point
- use plain, direct English without oversimplifying the substance
- explain unfamiliar terms naturally when the highlights support doing so
- prefer clear explanatory sentences over compressed fact-dense clauses
- split sentences when they carry 2+ technical nouns
- avoid meta framing (for example `this article explains`)
- avoid list-like or note-style prose
- require at least two concrete details; otherwise output `summary = INSUFFICIENT_SOURCE_DETAIL`
- ban counterfactual/future-projection framing unless explicitly present in highlights
- make small plain-English adjustments when titles are hard to interpret
- simplify or clarify academic, jargon-heavy, overly long, or confusing titles without changing the core meaning
- preserve named entities and the core claim without adding new claims; avoid full rewrites unless necessary for clarity
- keep the existing word target, but use the available space to make the idea understandable rather than maximizing detail count
- return strict JSON only (`title`, `summary`)
