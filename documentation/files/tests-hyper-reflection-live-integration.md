# File: `tests/hyper/reflection-live.integration.test.ts`

## Purpose
Runs the caring/metacognitive reflection pass against the live Anthropic model using fixed synthetic memory and recent-email evidence.

## Live Dependencies
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_REFLECTION_MODEL` or `ANTHROPIC_MEMORY_MODEL`

If required env vars are missing, the test is auto-skipped.

## Flow
1. Seed the run with fixed canonical memory containing a simple baseline profile.
2. Provide two recent sent emails showing current system behavior and mild repetition.
3. Provide two recent reply emails expressing stronger behavioral evidence about how the reader thinks and what they want.
4. Call `runBiDailyReflection(...)` directly against the live model.
5. Persist the input artifacts plus the reflection result for manual inspection.
6. Assert only stable contract guarantees:
   - `reviewedAt` echoes the run timestamp
   - decision is `no_change` or `rewrite`
   - returned memory still contains canonical sections
   - discovery brief fields are arrays

## Why The Assertions Stay Weak
Live reflection output is model-dependent. This test is intended as a smoke/evaluation harness, not a deterministic gold-label grader.

## Artifacts
Writes per-run traces to:
- `logs/hyper/reflection-live/<run-id>/00-current-memory.txt`
- `logs/hyper/reflection-live/<run-id>/01-recent-sent-emails.txt`
- `logs/hyper/reflection-live/<run-id>/02-recent-reply-emails.txt`
- `logs/hyper/reflection-live/<run-id>/03-reflection-result.txt`
- `logs/hyper/reflection-live/<run-id>/04-reflected-memory.txt`
