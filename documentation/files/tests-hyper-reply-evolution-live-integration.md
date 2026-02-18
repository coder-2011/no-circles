# File: `tests/hyper/reply-evolution-live.integration.test.ts`

## Purpose
Evaluates how reply-driven memory updates change the next discovery + summary output.

## Live Dependencies
- `TAVILY_API_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MEMORY_MODEL`
- `ANTHROPIC_SUMMARY_MODEL` (optional; defaults to `ANTHROPIC_MEMORY_MODEL`)

If any required env var is missing, test is auto-skipped.

## Flow
1. Build initial memory from synthetic brain dump.
2. Run discovery + summary and capture baseline outputs.
3. Apply synthetic reply update to memory.
4. Run discovery + summary again.
5. Persist before/after traces for side-by-side inspection.

## Artifacts
Writes per-run traces to:
- `logs/hyper/reply-evolution/<run-id>/00-input-brain-dump.txt`
- `logs/hyper/reply-evolution/<run-id>/01-reply-update.txt`
- `logs/hyper/reply-evolution/<run-id>/02-memory-before.txt`
- `logs/hyper/reply-evolution/<run-id>/03-memory-after.txt`
- `logs/hyper/reply-evolution/<run-id>/04-exa-before.txt`
- `logs/hyper/reply-evolution/<run-id>/05-exa-after.txt`
- `logs/hyper/reply-evolution/<run-id>/06-summary-before.txt`
- `logs/hyper/reply-evolution/<run-id>/07-summary-after.txt`
