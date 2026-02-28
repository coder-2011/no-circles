# File: `lib/pipeline/send-user-newsletter.ts`

## Purpose
Orchestrates PR9 single-user runtime: discovery -> Bloom gate -> summary -> personalized quote -> themed email render/send -> post-send state persistence.

## Runtime Flow
1. Load selected user row.
2. Build per-user local-date idempotency key scoped by issue variant (`daily` or `welcome`).
3. Optionally rotate Bloom state if estimated false-positive rate exceeds threshold.
4. Resolve target count (`10` default; configurable for welcome issue).
5. Run discovery with candidate include filter that excludes Bloom hits (`canonicalUrl`), with `maxAttempts=1`, `perTopicResults=7`, and URL-excerpt-required ranking.
6. Require enough discovery candidates to start, then fetch Exa highlights for winner URLs (`~4500` max chars each).
7. Drop candidates with missing/empty highlights (do not synthesize low-context entries); continue as long as at least one strong candidate remains.
8. Reserve outbound idempotency key and persist `issue_variant` on the row.
9. Generate summaries from strong candidates only; weak-context items may be skipped by summary stage.
   - passes `user.interest_memory_text` into the summary writer so `PERSONALITY` can calibrate summary depth/tone while keeping the default curious-generalist stance
   - marks summary inputs with `isSerendipitous=true` when candidate topic belongs to `discovery.serendipityTopics`.
10. Select one personalized quote (HF `quotes-500k` batch pull + Claude chooser) using `user_id + local_issue_date` deterministic sampling.
11. Build signed per-item feedback links (`more_like_this` / `less_like_this`) when `FEEDBACK_LINK_SECRET` and public site origin are available.
12. Randomly select one curated email theme template (`pickRandomNewsletterThemeTemplate`) for this send.
13. Render + send email (retry-once handled by send module) with available high-signal items; supports `daily` and `welcome` render variants.
14. After provider acceptance, mark outbound idempotency row as `sent` immediately (`provider_message_id` persisted first).
15. Persist user delivery state:
   - `users.last_issue_sent_at`
   - Bloom bits (`users.sent_url_bloom_bits`)
16. If post-send user-state persistence fails after idempotency has been marked `sent`, pipeline logs error and returns `sent` (with error detail) to avoid duplicate resend retries.
17. Any unexpected unhandled exception after idempotency reservation is caught; when idempotency is not yet marked `sent`, pipeline marks idempotency `failed` before returning `send_failed`.

## Feedback Link Notes
- Link generation uses deterministic token payload claims (`user_id`, `issue_id`, `url`, `feedback_type`, `item_position`) with expiry.
- Missing feedback env config disables links without failing send pipeline.

## Theme Selection Notes
- Theme selection is random per send from curated templates.
- The selected template id is included in structured send logs (`theme_template`) for QA/replay visibility.

## Idempotency Conflict Semantics
- `already_sent`: returns `sent` without duplicate provider send (`itemCount` is `0` because replay path does not reconstruct historical sent count)
- `already_processing`: returns `send_failed` with `IDEMPOTENCY_ALREADY_PROCESSING`
- `claimed` / `retryable_failed_claimed`: continue with normal send flow

## Result Statuses
- `sent`
- `insufficient_content`
- `send_failed`
- `internal_error`
