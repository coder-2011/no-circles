# File: `tests/hyper/query-system-live.integration.test.ts`

## Purpose
Provides a live inspection harness for the current query system (topic-derived query construction + Perplexity Sonar search).

## Live Dependencies
- `PERPLEXITY_API_KEY`

If missing, test is auto-skipped.

## Flow
1. Uses a canonical memory fixture with several active technical interests.
2. Runs `runDiscovery(...)` with live Sonar search and selector neutralization (`linkSelector -> null`) so this test isolates query generation + retrieval behavior.
3. Captures each live search request (`query`, `numResults`, response count, duration, sample URLs).
4. Writes full trace artifacts for manual inspection.
5. If discovery throws (for example insufficient quality), writes error artifact but still validates that query generation and live search executed.

## Assertions
- Harness captured either live query traces or an explicit discovery error artifact.
- When live queries are captured, at least one query includes configured recency operator text.

## Artifacts
Writes per-run traces to:
- `logs/hyper/query-system/<run-id>/00-interest-memory.txt`
- `logs/hyper/query-system/<run-id>/01-query-trace.txt`
- `logs/hyper/query-system/<run-id>/02-discovery-output.txt` (when discovery succeeds)
- `logs/hyper/query-system/<run-id>/02-discovery-error.txt` (when discovery throws)
