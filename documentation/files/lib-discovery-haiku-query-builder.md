# File: `lib/discovery/haiku-query-builder.ts`

## Purpose
Builds one creative, niche search query per topic/attempt using the shared Anthropic-compatible text-model transport for discovery retrieval.

## Contract
- Input:
  - `topic`
  - `interestMemoryText`
  - optional `discoveryBrief`
  - `attempt`
  - optional `referenceDateUtc`
- Output:
  - one single-line query string

## Prompt Behavior
- Frames the model as a `senior research librarian` in the Anthropic system prompt.
- Asks model for one-line query-only output.
- Emphasizes creativity, niche angle selection, and broad leeway in query framing.
- Uses `discoveryBrief` when present to avoid stale framing, prefer current angles, and nudge novelty without changing the underlying topic plan.
- Keeps constraints intentionally light so the model can explore unexpected angles.

## Runtime Safeguards
- Max query length: `140`
- Min query length: `12`
- Over-length outputs are truncated instead of rejected.
- Fallback is reserved for hard failures only (model call failure or empty/too-short output).

## Model Resolution
- `OPENROUTER_QUERY_BUILDER_MODEL`
- fallback: `OPENROUTER_LINK_SELECTOR_MODEL`
- fallback: `OPENROUTER_SUMMARY_MODEL`
- fallback: `OPENROUTER_MEMORY_MODEL`
- fallback: `ANTHROPIC_QUERY_BUILDER_MODEL`
- fallback: `ANTHROPIC_LINK_SELECTOR_MODEL`
- fallback: `ANTHROPIC_SUMMARY_MODEL`
- fallback: `ANTHROPIC_MEMORY_MODEL`

## Temperature
- Uses high creativity temperature (`0.85`) by design for diverse niche query generation.
