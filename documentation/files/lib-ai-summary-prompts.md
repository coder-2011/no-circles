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
- neutral, factual, source-grounded
- mild connective phrasing allowed
- keep original title unless minor clarity edit is needed
- no markdown/code fences in output
