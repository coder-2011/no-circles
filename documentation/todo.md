# Implementation Roadmap (PR-by-PR)

## Product Goal
Build a personalized daily newsletter system that:
- learns from user onboarding + reply updates
- curates and sends 10 high-quality links daily
- avoids repeats per user

## Planning Backlog: UX and Product Value Additions
These are candidate features for future scoped PRs after core pipeline stability.

1. Newsletter preview before first save
- Show a mock "today's issue" generated from onboarding text before submit.
- Goal: increase onboarding confidence and reduce first-send uncertainty.

2. Delivery status panel
- Show `last_sent_at`, `next_scheduled_send`, and interpreted timezone/send-time.
- Goal: reduce delivery confusion and improve reliability trust.

3. One-click feedback chips
- Add quick controls such as `More like this`, `Less like this`, `Too basic`, `Too advanced`.
- Goal: accelerate preference updates beyond free-text replies.

4. Source quality controls
- Let users choose inclusion preferences (for example research-heavy vs newsletters/blog-heavy).
- Goal: improve perceived signal quality and user control.

5. Onboarding starter templates
- Offer preset starting profiles (for example AI/engineering, history/philosophy).
- Goal: reduce blank-state friction and improve first-run output quality.

6. Digest intensity setting
- Allow issue size preferences (for example light/standard/deep).
- Goal: match cognitive load to user preference and improve retention.

## Current Status
- `feature/db-and-onboarding`: merged.
- `feature/google-auth`: merged.
- `feature/inbound-reply-memory-update`: merged (processor-driven onboarding memory + inbound webhook memory updates + idempotency).

## Temporary -> Permanent Ownership Map
- Resolved: onboarding memory raw copy-through (`brain_dump_text` -> `interest_memory_text`) is replaced by processor output in PR 3.
  - Permanent owner PR: `feature/inbound-reply-memory-update` (PR 3).
  - Downstream rule: PRs 5+ must treat memory as opaque input and must not redefine memory format rules.
- Temporary: onboarding identity was request-body based in early foundation.
  - Permanent owner PR: `feature/google-auth` (PR 2).
  - Status: resolved in PR 2.

## Delegation Guardrails (No Overlap)
- Each PR owns one contract boundary and one integration seam.
- If a PR depends on another PR’s contract, consume it; do not redesign it.
- Put behavior changes in the earliest owning PR, not in downstream PRs.
- PR 3 contract is merged; PR 4 is now the owner for upgrading memory quality/merge behavior.

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
- Status: merged
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

## PR 4: Real Memory Updater (Model + Merge)
- Branch: `feature/memory-updater-model`
- Dependency status:
  - assumes PR 3 contracts are available (canonical memory format, webhook idempotency, onboarding/reply processor seams).
- Primary objective:
  - replace fallback-only memory processing with model-backed, merge-correct memory updates.
- Frontend scope:
  - none.
- Backend scope:
  - implement model client in memory processors (remove permanent `MODEL_NOT_CONFIGURED` fallback path as default behavior).
  - add strict structured output validation before persistence.
  - implement true merge behavior for reply updates (preserve prior memory unless explicitly changed).
  - keep deterministic fallback for provider failure/invalid output only.
  - add observability on memory generation failure/fallback usage.
- Data and contracts:
  - preserve canonical output format (`PERSONALITY`, `ACTIVE_INTERESTS`, `SUPPRESSED_INTERESTS`, `RECENT_FEEDBACK`).
  - enforce 800-word cap after merge.
  - no schema changes required for this PR.
- Explicit non-goals:
  - no cron due-user selection changes.
  - no discovery/extraction/summary/send pipeline changes.
  - no webhook signature/idempotency redesign.
- Tests required:
  - onboarding memory uses model path when available.
  - reply processing merges with existing memory instead of replacing interest sections wholesale.
  - invalid model output triggers deterministic fallback and still satisfies contract + cap.
  - regression tests for canonical headers and max-word enforcement.
- Done when:
  - reply updates are cumulative and stable across multiple inbound messages.
  - fallback becomes exceptional path, not default.

## PR 5: Cron Due-User Selector
- Branch: `feature/cron-due-user-selector`
- Dependency status:
  - assumes PR 3 + PR 4 contracts are available (`interest_memory_text` canonicalization + model-backed merge stability + inbound idempotent updates)
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
  - due rule: user is due only when local run time is at/after local `send_time_local`.
  - already-sent-today rule: exclude users when `last_issue_sent_at` local date equals local run date.
  - scheduler delivery-state authority is `users.last_issue_sent_at` (not `newsletter_items`).
  - endpoint output shape:
    - `{ ok: true, status: "selected", user_id: string }`
    - `{ ok: true, status: "no_due_user" }`
  - maintain idempotent behavior under duplicate cron triggers.
  - consume `interest_memory_text` as opaque input; non-goal: memory processor/format changes.
  - non-goal: changing inbound webhook verification/signature/idempotency behavior from PR 3.
- Explicit non-goals:
  - no Exa discovery logic.
  - no content extraction logic.
  - no summary generation logic.
  - no send/history persistence writes.
- Tests required:
  - picks one due user.
  - returns `no_due_user` when none due.
  - already-sent-today users are excluded.
  - timezone boundary behavior around local midnight is correct.
  - unauthorized cron call rejected.
- Done when:
  - endpoint behaves deterministically for due/empty/unauthorized cases.

## PR 6: Discovery (Exa)
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
  - treat scheduler selection as precondition (from PR 5), do not re-implement due-user logic.
- Explicit non-goals:
  - no extraction/fetch fallback logic.
  - no model summarization logic.
  - no email send logic.
- Tests required:
  - topic derivation behavior on representative memory text.
  - dedupe logic correctness.
  - Exa client failure handling.
- Done when:
  - one user run yields a stable candidate pool ready for extraction.

## PR 7: Content Extraction + Fallback
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
  - consume discovery candidates from PR 6, do not alter topic/discovery ranking rules.
- Explicit non-goals:
  - no summary-writing prompts.
  - no email send/persistence behavior.
- Tests required:
  - success on standard HTML page.
  - fallback path invoked on failure case.
  - graceful handling for unreadable pages.
- Done when:
  - extraction success rate is high enough for daily 10-item assembly.

## PR 8: Summary Generation (Claude)
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
  - consume extraction output from PR 7, do not change extraction transport/fallback policy.
- Explicit non-goals:
  - no Resend send integration.
  - no newsletter history pruning logic.
- Tests required:
  - schema validation for model output.
  - rejection/regeneration behavior for malformed outputs.
- Done when:
  - 10 valid item objects are produced for a full run.

## PR 9: Send + History Persistence
- Branch: `feature/send-and-history`
- Primary objective:
  - deliver generated newsletter and write sent history for anti-repeat guarantees.
- Frontend scope:
  - optional: basic “last send status” admin/debug screen (if small).
- Backend scope:
  - render and send newsletter via Resend.
  - render greeting/personalization using `users.preferred_name` (fallback required for legacy rows).
  - insert sent items into `newsletter_items`.
  - enforce URL never-repeat via unique constraint handling.
  - prune history to retention target (latest 100 URLs/user).
- Data and contracts:
  - send result and persistence outcome must be observable in logs.
  - consume summary item shape from PR 8, do not alter summary contract.
- Tests required:
  - send success path persists history.
  - duplicate URL conflict handled safely.
  - retention pruning logic correctness.
- Done when:
  - sends complete and history reliably prevents repeats.

## PR 10: End-to-End Happy Path
- Branch: `feature/e2e-happy-path`
- Primary objective:
  - lock baseline user journey with automated confidence.
- Frontend scope:
  - Playwright coverage: auth/onboarding UX path.
- Backend scope:
  - integration tests for cron selection, memory update, and send pipeline seams.
- Data and contracts:
  - test fixtures and mocks standardized across providers.
- Explicit non-goals:
  - no product behavior changes unless required to unblock tests.
- Tests required:
  - onboarding -> generation trigger -> send/history write smoke path.
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
