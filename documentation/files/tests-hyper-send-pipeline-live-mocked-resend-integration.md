# File: `tests/hyper/send-pipeline-live-mocked-resend.integration.test.ts`

## Purpose
Validates the PR9 send pipeline with real discovery + real summary generation while mocking only Resend delivery.

## Live Dependencies
- `DATABASE_URL`
- `EXA_API_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MEMORY_MODEL` or `ANTHROPIC_SUMMARY_MODEL`
If required env vars are missing, test fails with `LIVE_ENV_MISSING:*`.

## Mocking Policy
- `resend` provider is mocked to avoid external email delivery side effects.
- Anthropic and Exa are live (no mocks).

## Flow
1. Insert temporary user row in `public.users` with canonical memory text.
2. Run `sendUserNewsletter(...)` for that user.
3. Assert pipeline status is `sent` and item count is 10.
4. Verify persisted post-send DB state:
   - `users.last_issue_sent_at` updated
   - `users.sent_url_bloom_bits` populated
   - `outbound_send_idempotency` row marked `sent` with provider id
5. Write run artifacts under `logs/hyper/full-system/<run-id>/send-pipeline-result.txt`.
6. Clean up temporary DB rows.
