# File: `lib/pipeline/send-user-newsletter.ts`

## Purpose
Orchestrates PR9 single-user runtime: discovery -> Bloom gate -> summary -> email send -> post-send state persistence.

## Runtime Flow
1. Load selected user row.
2. Build per-user local-date idempotency key.
3. Optionally rotate Bloom state if estimated false-positive rate exceeds threshold.
4. Resolve target count (`10` default; configurable for welcome issue).
5. Run discovery with candidate include filter that excludes Bloom hits (`canonicalUrl`), with `maxRetries=1`, `perTopicResults=7`, and URL-excerpt-required ranking.
6. Require exactly target-count candidates.
7. Fetch Exa highlights for winner URLs (`~4500` max chars each) and keep only candidates with non-empty highlights.
8. Reserve outbound idempotency key.
9. Generate target-count summaries.
10. Render + send email (retry-once handled by send module); supports `daily` and `welcome` render variants.
11. On success, transactionally persist:
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
