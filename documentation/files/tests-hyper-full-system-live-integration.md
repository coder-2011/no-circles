# File: `tests/hyper/full-system-live.integration.test.ts`

## Purpose
Runs full live smoke path from onboarding brain dump through discovery and summary generation.

## Live Dependencies
- `EXA_API_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MEMORY_MODEL`
- `ANTHROPIC_SUMMARY_MODEL` (optional; defaults to `ANTHROPIC_MEMORY_MODEL`)

If any required env var is missing, test is auto-skipped.

## Flow
1. Build onboarding memory from a diverse synthetic brain dump spanning technical + non-technical interests.
2. Capture live query trace entries (`query`, `numResults`, latency, result count) from Perplexity search calls during discovery.
3. Run live discovery for target 10 candidates with production-like constraints (`maxRetries: 1`, `requireUrlExcerpt: true`).
4. Run live Claude summary generation for all candidates.
5. Persist human-readable trace files.

## Artifacts
Writes per-run traces to:
- `logs/hyper/full-system/<run-id>/input-brain-dump.txt`
- `logs/hyper/full-system/<run-id>/interest-memory.txt`
- `logs/hyper/full-system/<run-id>/query-trace.txt`
- `logs/hyper/full-system/<run-id>/exa-discovery-output.txt`
- `logs/hyper/full-system/<run-id>/claude-summary-output.txt`
