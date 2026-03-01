# File: `tests/hyper/reflection-seeded-history-live.integration.test.ts`

## Purpose
Runs a permanent live reflection case where recent sent emails are intentionally broad and repeated recent replies strongly reinforce a builder/optimizer preference.

## Live Dependencies
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_REFLECTION_MODEL` or `ANTHROPIC_MEMORY_MODEL`

If required env vars are missing, the test is auto-skipped.

## Flow
1. Start from a broad but plausible canonical memory.
2. Provide three recent sent emails that over-index on broad narrative/trend framing.
3. Provide four recent replies that repeatedly reinforce builder/optimizer preferences, operational detail, mechanisms, and durable non-narrative framing.
4. Call `runBiDailyReflection(...)` directly against the live model.
5. Persist inputs and outputs for manual inspection.
6. Assert a stronger contract than the basic reflection smoke test:
   - decision is `rewrite`
   - rewritten memory keeps canonical sections
   - rewritten memory includes builder/optimizer/mechanism signals
   - discovery brief contains non-empty steering

## Why It Exists
The lighter reflection smoke test proves the model call works. This test proves the reflection layer can actually perform a meaningful rewrite when evidence is strong and cleanly separated from reply-merge behavior.

## Artifacts
Writes per-run traces to:
- `logs/hyper/reflection-seeded-history/<run-id>/00-current-memory.txt`
- `logs/hyper/reflection-seeded-history/<run-id>/01-recent-sent-emails.txt`
- `logs/hyper/reflection-seeded-history/<run-id>/02-recent-reply-emails.txt`
- `logs/hyper/reflection-seeded-history/<run-id>/03-reflection-result.txt`
- `logs/hyper/reflection-seeded-history/<run-id>/04-reflected-memory.txt`
