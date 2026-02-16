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
1. Build onboarding memory from synthetic brain dump.
2. Run live Exa discovery for target 10 candidates.
3. Run live Claude summary generation for all candidates.
4. Persist human-readable trace files.

## Artifacts
Writes per-run traces to:
- `logs/hyper/full-system/<run-id>/input-brain-dump.txt`
- `logs/hyper/full-system/<run-id>/interest-memory.txt`
- `logs/hyper/full-system/<run-id>/exa-discovery-output.txt`
- `logs/hyper/full-system/<run-id>/claude-summary-output.txt`
