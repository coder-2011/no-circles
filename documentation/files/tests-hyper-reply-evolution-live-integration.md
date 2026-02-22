# File: `tests/hyper/reply-evolution-live.integration.test.ts`

## Purpose
Evaluates how reply-driven memory updates change the next discovery + summary output.

## Live Dependencies
- `EXA_API_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MEMORY_MODEL`
- `ANTHROPIC_SUMMARY_MODEL` (optional; defaults to `ANTHROPIC_MEMORY_MODEL`)

If any required env var is missing, test is auto-skipped.

## Flow
1. Build initial memory from a deliberately messy, diverse synthetic brain dump (technical + non-technical interests).
2. If onboarding model generation is unavailable (`ONBOARDING_MODEL_REQUIRED`), write a skip artifact and exit without failing this live smoke test.
3. Run discovery + summary in strict mode first (`requireUrlExcerpt=true`, low breadth).
4. If strict mode fails with `INSUFFICIENT_QUALITY_CANDIDATES`, retry in relaxed mode (`requireUrlExcerpt=false`, higher breadth/retries).
5. Capture per-attempt live query traces (`mode`, query text, `numResults`, latency, result count).
6. Capture baseline outputs when discovery succeeds.
7. Apply synthetic reply update to memory.
8. Repeat discovery + summary with the same strict-first fallback strategy.
9. Persist before/after traces for side-by-side inspection.
10. If both strict and relaxed discovery fail for either phase, log the skip reason and exit without failing this live smoke test.

Runtime knobs:
- strict discovery: `maxRetries=1`, `perTopicResults=4`, `requireUrlExcerpt=true`, `targetCount=10`
- relaxed discovery fallback: `maxRetries=2`, `perTopicResults=7`, `requireUrlExcerpt=false`, `targetCount=10`
- summary target: `targetWords=100`
- test timeout: `420000ms` (7 minutes)

## Artifacts
Writes per-run traces to:
- `logs/hyper/reply-evolution/<run-id>/00-input-brain-dump.txt`
- `logs/hyper/reply-evolution/<run-id>/00-live-skip-onboarding-model.txt` (only when onboarding model is unavailable)
- `logs/hyper/reply-evolution/<run-id>/01-reply-update.txt`
- `logs/hyper/reply-evolution/<run-id>/02-memory-before.txt`
- `logs/hyper/reply-evolution/<run-id>/03-memory-after.txt`
- `logs/hyper/reply-evolution/<run-id>/04-discovery-attempts-before.txt`
- `logs/hyper/reply-evolution/<run-id>/05-discovery-attempts-after.txt`
- `logs/hyper/reply-evolution/<run-id>/06-live-skip-reason.txt` (only when both discovery modes fail)
- `logs/hyper/reply-evolution/<run-id>/07-exa-before.txt`
- `logs/hyper/reply-evolution/<run-id>/08-exa-after.txt`
- `logs/hyper/reply-evolution/<run-id>/09-summary-before.txt`
- `logs/hyper/reply-evolution/<run-id>/10-summary-after.txt`
