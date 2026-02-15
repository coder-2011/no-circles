# Implementation Roadmap (PR-by-PR)

## Product Goal
Build a personalized daily newsletter system that:
- learns from user onboarding + reply updates
- curates and sends 10 high-quality links daily
- avoids repeats per user

## Current Status
- `feature/db-and-onboarding`: merged.
- Known follow-up gap: onboarding currently copies `brain_dump_text` directly into `interest_memory_text` (processor path not implemented yet).

## PR 1: DB + Onboarding Foundation
- Branch: `feature/db-and-onboarding`
- Status: merged
- Outcome:
  - persistent user state and onboarding write path established.

## PR 2: Google Auth Wiring
- Branch: `feature/google-auth`
- Primary objective:
  - replace temporary payload-based identity with real session identity.
- Frontend scope:
  - add clear sign-in entrypoint (button/page).
  - add signed-in/signed-out states in onboarding page.
  - redirect unauthenticated users away from protected onboarding screens.
  - show actionable auth error state in UI.
- Backend scope:
  - wire Google OAuth session retrieval in server routes.
  - update `POST /api/onboarding` to derive identity from session user.
  - reject onboarding requests without valid session.
  - keep existing onboarding memory-write behavior unchanged in this PR (no processor logic changes).
- Data and contracts:
  - remove trust in request body `email` for identity decisions.
  - keep payload fields only for profile/preferences.
  - non-goal: changing how `brain_dump_text` is transformed into `interest_memory_text`.
- Tests required:
  - unit/integration test for unauthenticated request -> `401/403`.
  - authenticated request succeeds and writes correct user row.
  - UI test for redirect when signed out.
- Done when:
  - user can sign in via Google.
  - authenticated user can complete onboarding.
  - onboarding route does not use payload identity.

## PR 3: Inbound Reply Memory Update
- Branch: `feature/inbound-reply-memory-update`
- Primary objective:
  - implement processor-driven memory updates for both onboarding and inbound replies.
- Frontend scope:
  - none required for MVP; optional status/debug view deferred.
- Backend scope:
  - add onboarding memory processor: `{ brain_dump_text } -> formatted interest memory`.
  - update onboarding path to persist only processor output (not raw copy-through).
  - implement webhook signature verification.
  - map sender email to user row.
  - parse inbound plain text body.
  - call reply memory processor with `{ current_interest_memory_text, inbound_reply_text }`.
  - persist validated updated memory text.
  - add idempotency guard by provider message id.
- Data and contracts:
  - onboarding processor contract and reply processor contract are separate inputs with a shared canonical memory output shape.
  - idempotency key store strategy must be explicit (table or durable store).
  - ignored events return `{ ok: true, status: "ignored" }`.
- Tests required:
  - onboarding processor output shape validation + persistence behavior.
  - invalid signature ignored/rejected.
  - replayed event does not double-apply.
  - valid event updates memory once.
- Done when:
  - onboarding no longer stores raw `brain_dump_text` as direct memory copy.
  - reply webhook safely updates `interest_memory_text` exactly once per message.

## PR 4: Cron Due-User Selector
- Branch: `feature/cron-due-user-selector`
- Primary objective:
  - create deterministic, one-user-per-tick scheduler entrypoint.
- Frontend scope:
  - none.
- Backend scope:
  - implement `POST /api/cron/generate-next` auth via service secret.
  - compute due users from timezone + `send_time_local`.
  - select one due user atomically.
  - return `no_due_user` when queue empty.
- Data and contracts:
  - maintain idempotent behavior under duplicate cron triggers.
- Tests required:
  - picks one due user.
  - returns `no_due_user` when none due.
  - unauthorized cron call rejected.
- Done when:
  - endpoint behaves deterministically for due/empty/unauthorized cases.

## PR 5: Discovery (Exa)
- Branch: `feature/exa-discovery`
- Primary objective:
  - generate candidate links aligned to user memory.
- Frontend scope:
  - none.
- Backend scope:
  - derive topic list from `interest_memory_text`.
  - call Exa per topic.
  - dedupe URL candidates.
  - preserve enough metadata for downstream ranking.
- Data and contracts:
  - consistent candidate object shape for next pipeline stage.
- Tests required:
  - topic derivation behavior on representative memory text.
  - dedupe logic correctness.
  - Exa client failure handling.
- Done when:
  - one user run yields a stable candidate pool ready for extraction.

## PR 6: Content Extraction + Fallback
- Branch: `feature/content-extraction`
- Primary objective:
  - reliably extract article content from candidate URLs.
- Frontend scope:
  - none.
- Backend scope:
  - implement default fetch/extract path.
  - implement Playwright fallback for JS-heavy pages.
  - normalize extracted output shape.
- Data and contracts:
  - extraction output should include URL, title (if available), and body text.
- Tests required:
  - success on standard HTML page.
  - fallback path invoked on failure case.
  - graceful handling for unreadable pages.
- Done when:
  - extraction success rate is high enough for daily 10-item assembly.

## PR 7: Summary Generation (Claude)
- Branch: `feature/summary-writer`
- Primary objective:
  - transform extracted content into neutral, grounded newsletter items.
- Frontend scope:
  - none.
- Backend scope:
  - implement summary generation prompt and response schema.
  - produce `{title, summary, url}` item outputs.
  - enforce style rules: neutral, concise, source-grounded.
- Data and contracts:
  - output shape locked for email renderer.
- Tests required:
  - schema validation for model output.
  - rejection/regeneration behavior for malformed outputs.
- Done when:
  - 10 valid item objects are produced for a full run.

## PR 8: Send + History Persistence
- Branch: `feature/send-and-history`
- Primary objective:
  - deliver generated newsletter and write sent history for anti-repeat guarantees.
- Frontend scope:
  - optional: basic “last send status” admin/debug screen (if small).
- Backend scope:
  - render and send newsletter via Resend.
  - insert sent items into `newsletter_items`.
  - enforce URL never-repeat via unique constraint handling.
  - prune history to retention target (latest 100 URLs/user).
- Data and contracts:
  - send result and persistence outcome must be observable in logs.
- Tests required:
  - send success path persists history.
  - duplicate URL conflict handled safely.
  - retention pruning logic correctness.
- Done when:
  - sends complete and history reliably prevents repeats.

## PR 9: End-to-End Happy Path
- Branch: `feature/e2e-happy-path`
- Primary objective:
  - lock baseline user journey with automated confidence.
- Frontend scope:
  - Playwright coverage: auth/onboarding UX path.
- Backend scope:
  - integration tests for cron selection, memory update, and send pipeline seams.
- Data and contracts:
  - test fixtures and mocks standardized across providers.
- Tests required:
  - onboarding -> generation trigger -> send/history write smoke path.
  - replay/idempotency assertions where possible.
- Done when:
  - core pipeline has stable automated regression coverage.

## PR 10: Ops Hardening
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
- Tests required:
  - env missing -> startup fails clearly.
  - provider outage -> graceful error, no silent corruption.
- Done when:
  - operational failures are visible and system degrades safely.

## Working Rules
- one subsystem per branch
- small, reviewable commits
- keep PR focused; split if scope grows too wide
- before opening PR: `npm run lint`, `npm run test`, and relevant integration checks
