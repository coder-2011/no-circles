# File: `lib/discovery/haiku-query-builder.ts`

## Purpose
Builds one creative, niche search query per topic/attempt using Anthropic Haiku for discovery retrieval.

## Contract
- Input:
  - `topic`
  - `interestMemoryText`
  - `attempt`
  - optional `referenceDateUtc`
- Output:
  - one single-line query string

## Prompt Behavior
- Frames the model as a `senior research librarian` in the Anthropic system prompt.
- Asks model for one-line query-only output.
- Emphasizes creativity, niche angle selection, and broad leeway in query framing.
- Keeps constraints intentionally light so the model can explore unexpected angles.

## Runtime Safeguards
- Max query length: `140`
- Min query length: `12`
- Over-length outputs are truncated instead of rejected.
- Fallback is reserved for hard failures only (model call failure or empty/too-short output).

## Model Resolution
- `ANTHROPIC_QUERY_BUILDER_MODEL`
- fallback: `ANTHROPIC_LINK_SELECTOR_MODEL`
- fallback: `ANTHROPIC_SUMMARY_MODEL`
- fallback: `ANTHROPIC_MEMORY_MODEL`

## Temperature
- Uses high creativity temperature (`0.85`) by design for diverse niche query generation.
