# TODO System Note

The live task system is now the root `TODO.md` file.

Use `TODO.md` for all active planning and execution tracking:
- pending tasks use `- [ ]`
- completed tasks use `- [x]`
- tasks are grouped by `Hardware`, `AI`, and `Research`

This file is no longer the active backlog and should not be used as a second task tracker.

## PR 9: Send + Bloom Filter Anti-Repeat
- Branch: `feature/send-and-history`
- Primary objective:
  - deliver generated newsletter and update per-user Bloom filter state for anti-repeat guarantees.
- Frontend scope:
  - optional: basic “last send status” admin/debug screen (if small).
- Backend scope:
  - render and send newsletter via Resend.
  - render greeting/personalization using `users.preferred_name` (fallback required for legacy rows).
  - check Bloom membership during discovery candidate intake (canonical URL) to suppress likely repeats before summary generation.
  - hash each successfully sent canonical URL and set corresponding bits in user Bloom filter.
  - reserve outbound idempotency key per user local date before provider send.
  - update `users.last_issue_sent_at` only after successful send.
  - define Bloom rotation/reset policy to cap false-positive growth.
- Data and contracts:
  - send result and persistence outcome must be observable in logs.
  - consume summary item shape from PR 8, do not alter summary contract.
  - idempotency key contract: `newsletter:v1:<user_id>:<local_issue_date>`
  - anti-repeat contract is probabilistic (Bloom filter false positives possible, false negatives should not occur after successful bit updates).
- Tests required:
  - send success path updates Bloom filter deterministically.
  - repeated URL candidate is filtered when Bloom indicates prior send.
  - rotation/reset path preserves system safety (no crashes, explicit logs).
- Done when:
  - sends complete and Bloom-based anti-repeat reliably suppresses prior links.

## PR 10: End-to-End Happy Path
- Branch: `feature/e2e-happy-path`
- Primary objective:
  - lock baseline user journey with automated confidence.
- Frontend scope:
  - UI journey coverage for auth/onboarding path.
- Backend scope:
  - integration tests for cron selection, memory update, and send pipeline seams.
- Data and contracts:
  - test fixtures and mocks standardized across providers.
- Explicit non-goals:
  - no product behavior changes unless required to unblock tests.
- Tests required:
  - onboarding -> generation trigger -> send/Bloom-update smoke path.
  - replay/idempotency assertions where possible.
- Done when:
  - core pipeline has stable automated regression coverage.

## PR 11: Ops Hardening
- Branch: `feature/ops-hardening-v1`
- Primary objective:
  - make failures diagnosable, safe, and recoverable in production.
- Frontend scope:
  - optional: operator-facing health/readiness view (only if low effort).
- Backend scope:
  - structured logs across all pipeline stages.
  - centralized env validation at startup.
  - explicit fallback/error handling for provider outages.
  - alert-ready error codes and clear retry boundaries.
- Data and contracts:
  - standardized error envelope + log fields across routes/jobs.
- Explicit non-goals:
  - no major feature redesign; reliability/observability only.
- Tests required:
  - env missing -> startup fails clearly.
  - provider outage -> graceful error, no silent corruption.
- Done when:
  - operational failures are visible and system degrades safely.

## PR 12: Contextual Curiosity Discovery
- Branch: `feature/contextual-curiosity-discovery`
- Primary objective:
  - evolve discovery from broad topical retrieval into progressive, context-aware retrieval.
- Frontend scope:
  - none.
- Backend scope:
  - add query-intent lanes per topic (`core_depth`, `adjacent`, `edge_serendipity`).
  - add anti-generic query constraints to reduce beginner/intro/listicle output.
  - preserve Bloom anti-repeat gating and add a tiny recoverable recent-learning store (recent canonical URLs/topics/domains) for progression context.
  - generate "next-layer" queries informed by recent learning history + memory text.
  - keep deterministic scoring/ranking first; optional tiny-model tie-breaker only for borderline candidates.
- Data and contracts:
  - keep current discovery output contract unchanged for downstream PR7/PR8/PR9 compatibility.
  - do not rely on Bloom as recoverable history (Bloom is membership-only).
  - target discovery composition policy:
    - `~70%` core-depth
    - `~20%` adjacent
    - `~10%` controlled serendipity
- Explicit non-goals:
  - no send pipeline redesign.
  - no onboarding/reply memory contract redesign.
  - no UI changes in this PR.
- Tests required:
  - query builder emits lane-specific constraints and progression hints.
  - recent-learning history influences next query set deterministically.
  - output keeps target count and existing schema under mixed lane success/failure.
  - Bloom-only mode remains safe when recent-learning history is unavailable.
- Done when:
  - manual and hyper evaluation shows lower generic-result rate and stronger perceived progression without regressions in diversity/coverage.

## Working Rules
- one subsystem per branch
- small, reviewable commits
- keep PR focused; split if scope grows too wide
- before opening PR: `npm run lint`, `npm run test`, and relevant integration checks

## Current User E2E Checklist (PR3 Baseline)
1. Run app locally and expose webhook route publicly:
  - `npm run dev`
  - start tunnel to `localhost:3000` (for example ngrok)
2. Configure env vars:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `RESEND_WEBHOOK_SECRET`
3. Ensure DB schema is up to date:
  - migration `0001_sturdy_ion` applied (`processed_webhooks` exists)
4. Complete real user onboarding:
  - sign in with Google
  - submit onboarding form
  - verify canonical `interest_memory_text` was persisted for user
5. Configure Resend inbound webhook:
  - endpoint: `https://<public-host>/api/webhooks/resend/inbound`
  - event type: `email.received` only
6. Send a real reply email from onboarded user address:
  - expected response path: `{ ok: true, status: "updated" }` when new event
7. Verify DB outcomes:
  - `users.interest_memory_text` updated once
  - `processed_webhooks` row inserted with `provider='resend'` + unique `webhook_id`
8. Replay same webhook event:
  - expected response path: `{ ok: true, status: "ignored" }`
  - verify no second memory mutation
