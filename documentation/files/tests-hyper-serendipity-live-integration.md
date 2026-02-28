# File: `tests/hyper/serendipity-live.integration.test.ts`

## Purpose
Provides an opt-in live smoke test for the serendipity lane: Anthropic topic expansion plus discovery exposure of those adjacent topics.

## Live Dependencies
- `ANTHROPIC_API_KEY`
- one configured Anthropic model env from:
  - `ANTHROPIC_SERENDIPITY_MODEL`
  - `ANTHROPIC_LINK_SELECTOR_MODEL`
  - `ANTHROPIC_SUMMARY_MODEL`
  - `ANTHROPIC_MEMORY_MODEL`

If any are missing, the test is auto-skipped.

## Flow
1. Uses a fixed memory fixture with five active technical interests and explicit "adjacent topics" feedback.
2. Calls `selectSerendipityTopics(...)` live and asserts it returns distinct non-active topics.
3. Runs `runDiscovery(...)` with deterministic search results and selector neutralization (`linkSelector -> null`) so the signal under test is topic-lane construction, not live retrieval quality or per-topic winner reordering.
4. Writes artifacts for manual inspection.

## Assertions
- live serendipity selector returns `1..2` topics
- selected topics are unique
- selected topics do not duplicate active topics
- `runDiscovery(...)` surfaces `serendipityTopics` in the same non-active shape
- surfaced serendipity topics are present in the discovery topic plan
- query trace count covers the topic plan

## Artifacts
Writes per-run traces to:
- `logs/hyper/serendipity/<run-id>/00-interest-memory.txt`
- `logs/hyper/serendipity/<run-id>/01-selector-output.txt`
- `logs/hyper/serendipity/<run-id>/02-query-trace.txt`
- `logs/hyper/serendipity/<run-id>/03-discovery-output.txt`
