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
- prioritize concept coverage (mechanisms/findings/tradeoffs) from highlights rather than meta article-description framing
- cover one to three important ideas as needed for clarity; explain rather than list
- provide enough explanation to stand on its own while still leaving deeper detail for click-through
- minimize redundancy by collapsing repeated ideas into one precise phrase while preserving grammar and necessary nuance
- avoid filler lead-ins such as "the key idea is", "the main takeaway is", and "the core point is"
- avoid telegraphic compression; prefer complete, clean sentences with natural flow
- preserve original title wording by default; edit only when title clarity is insufficient
- when title edits are needed, keep edits minimal and avoid trailing generic format labels (for example `article`, `postmortem`, `post`, `thread`, `report`) unless essential to meaning
- prefer clear, direct language and simpler word choices when accuracy is unchanged
- no markdown/code fences in output
