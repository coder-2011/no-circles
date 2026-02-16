# File: `lib/pipeline/send-user-newsletter.ts`

## Purpose
Orchestrates PR9 single-user runtime: discovery -> Bloom gate -> summary -> email send -> post-send state persistence.

## Runtime Flow
1. Load selected user row.
2. Build per-user local-date idempotency key.
3. Optionally rotate Bloom state if estimated false-positive rate exceeds threshold.
4. Run discovery with candidate include filter that excludes Bloom hits (`canonicalUrl`).
5. Require exactly 10 candidates.
6. Reserve outbound idempotency key.
7. Generate 10 summaries.
8. Render + send email (retry-once handled by send module).
9. On success, transactionally persist:
   - `users.last_issue_sent_at`
   - Bloom bits (`users.sent_url_bloom_bits`)
   - idempotency status `sent` + provider id

## Idempotency Conflict Semantics
- `already_sent`: returns `sent` without duplicate provider send
- `already_processing`: returns `send_failed` with `IDEMPOTENCY_ALREADY_PROCESSING`
- `claimed` / `retryable_failed_claimed`: continue with normal send flow

## Result Statuses
- `sent`
- `insufficient_content`
- `send_failed`
- `internal_error`
