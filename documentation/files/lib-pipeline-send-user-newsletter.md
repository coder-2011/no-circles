# File: `lib/pipeline/send-user-newsletter.ts`

## Purpose
Orchestrates single-user runtime: optional bi-daily reflection -> discovery -> Bloom gate -> summary -> personalized quote -> themed email render/send -> post-send state persistence.

## Runtime Flow
1. Load selected user row.
2. Build per-user local-date idempotency key scoped by issue variant (`daily` or `welcome`).
3. For `daily` sends only, optionally run the bi-daily reflection review:
   - gated by `users.last_reflection_at`
   - reads last 5 sent emails + last 5 reply emails
   - may rewrite `interest_memory_text`
   - emits an ephemeral `discoveryBrief` for the current send
4. Optionally rotate Bloom state if estimated false-positive rate exceeds threshold.
5. Resolve target count (`10` default; configurable for welcome issue).
6. Run discovery with candidate include filter that excludes Bloom hits (`canonicalUrl`), with `maxAttempts=1`, `perTopicResults=7`, URL-excerpt-required ranking, and optional `discoveryBrief` steering.
7. Require enough discovery candidates to start, then fetch Exa highlights for winner URLs (`~4500` max chars each).
8. Drop candidates with missing/empty highlights (do not synthesize low-context entries); continue as long as at least one strong candidate remains.
9. Reserve outbound idempotency key and persist `issue_variant` on the row.
10. Generate summaries from strong candidates only; weak-context items may be skipped by summary stage.
   - passes `user.interest_memory_text` into the summary writer so `PERSONALITY` can calibrate summary depth/tone while keeping the default curious-generalist stance
   - marks summary inputs with `isSerendipitous=true` when candidate topic belongs to `discovery.serendipityTopics`.
11. Select one personalized quote (HF `quotes-500k` batch pull + Claude chooser) using `user_id + local_issue_date` deterministic sampling.
12. Build signed per-item feedback links (`more_like_this` / `less_like_this`) when `FEEDBACK_LINK_SECRET` and public site origin are available.
13. Randomly select one curated email theme template (`pickRandomNewsletterThemeTemplate`) for this send.
14. Render + send email (retry-once handled by send module) with available high-signal items; supports `daily` and `welcome` render variants.
15. After provider acceptance, mark outbound idempotency row as `sent` immediately (`provider_message_id` persisted first).
16. Best-effort record one `sent` row in `user_email_history` using the final rendered subject/text.
17. Persist user delivery state:
   - `users.last_issue_sent_at`
   - Bloom bits (`users.sent_url_bloom_bits`)
18. If post-send user-state persistence fails after idempotency has been marked `sent`, pipeline logs error and returns `sent` (with error detail) to avoid duplicate resend retries.
19. Any unexpected unhandled exception after idempotency reservation is caught; when idempotency is not yet marked `sent`, pipeline marks idempotency `failed` before returning `send_failed`.

## Feedback Link Notes
- Link generation uses deterministic token payload claims (`user_id`, `issue_id`, `url`, `feedback_type`, `item_position`) with expiry.
- Missing feedback env config disables links without failing send pipeline.

## Theme Selection Notes
- Theme selection is random per send from curated templates.
- The selected template id is included in structured send logs (`theme_template`) for QA/replay visibility.

## Idempotency Conflict Semantics
- `already_sent`: returns `sent` without duplicate provider send (`itemCount` is `0` because replay path does not reconstruct historical sent count)
- `already_processing`: returns `send_failed` with `IDEMPOTENCY_ALREADY_PROCESSING`
- `claimed` / `retryable_failed_claimed` / `stale_processing_claimed`: continue with normal send flow

## Result Statuses
- `sent`
- `insufficient_content`
- `send_failed`
- `internal_error`
