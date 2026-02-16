# Build To-Do

## First Thing To Work On
Start with `feature/db-and-onboarding`.

Why:
- everything else depends on persisted user state
- onboarding writes `interest_memory_text`, timezone, send time
- cron and reply webhook both need DB reads/writes immediately

## Execution Plan (Branch-by-Branch)

## 1) DB + Onboarding Foundation
- Branch: `feature/db-and-onboarding`
- Tasks:
  - configure Supabase connection
  - define `users` and `newsletter_items` schema in `lib/db/schema.ts`
  - add migration flow under `db/`
  - implement `POST /api/onboarding` with zod validation + DB write
- Done when:
  - onboarding request persists user data
  - DB schema exists and migrations run cleanly

## 2) Google Auth Wiring
- Branch: `feature/google-auth`
- Tasks:
  - wire Google OAuth flow in Next.js
  - protect onboarding route for authenticated users
- Done when:
  - user can sign in and call onboarding successfully

## 3) Resend Inbound Webhook
- Branch: `feature/inbound-reply-memory-update`
- Tasks:
  - verify webhook signature
  - parse inbound sender + message
  - load current `interest_memory_text`
  - call Claude to merge current memory + reply text
  - save merged memory
- Done when:
  - valid inbound reply updates user memory
  - replayed webhook message is ignored safely

## 4) Cron Driver (One User Per Tick)
- Branch: `feature/cron-due-user-selector`
- Tasks:
  - implement `POST /api/cron/generate-next`
  - select one due user each run
  - return `no_due_user` when none available
- Done when:
  - endpoint reliably picks one due user at a time

## 5) Discovery (Exa)
- Branch: `feature/exa-discovery`
- Tasks:
  - derive topics from `interest_memory_text`
  - fetch candidates via Exa per topic
  - dedupe URLs before selection
- Done when:
  - candidate pool is generated for one user run

## 6) Extraction + Playwright Fallback
- Branch: `feature/content-extraction`
- Tasks:
  - normal extraction path
  - Playwright fallback for JS-heavy pages
- Done when:
  - text extraction succeeds for most candidate links

## 7) Summary Generation (Claude)
- Branch: `feature/summary-writer`
- Tasks:
  - generate title + short TLDR-style summary per selected article
  - keep neutral, grounded output
- Done when:
  - 10 item objects are generated for a user run

## 8) Send + History Persistence
- Branch: `feature/send-and-history`
- Tasks:
  - send issue via Resend
  - use `users.preferred_name` for email greeting/personalization (fallback when missing)
  - save sent URLs in `newsletter_items`
  - enforce never-repeat (`user_id`, `url` unique)
  - prune history to latest 100 per user
- Done when:
  - email sends and history persists correctly

## 9) End-to-End Happy Path
- Branch: `feature/e2e-happy-path`
- Tasks:
  - add Vitest coverage for core logic (schemas, due-user selection, memory update)
  - add Playwright e2e for onboarding -> send loop (mock integrations as needed)
- Done when:
  - basic pipeline passes in automated tests

## 10) Ops + Safety Pass
- Branch: `feature/ops-hardening-v1`
- Tasks:
  - add structured logs at each pipeline stage
  - add env validation and startup checks
  - add failure-safe responses for provider outages
- Done when:
  - failures are visible and recoverable

## Working Rules
- one subsystem per branch
- micro commits during implementation
- open PR once branch diff approaches 500-800 lines
- avoid `git add .`; use `git add -A` or explicit pathspecs
