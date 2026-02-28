# Architecture

## Overview
This system is a website-first, email-delivered personalized newsletter product. It uses a single Next.js codebase with a minimal persistent data model. Personalization is driven by one evolving text memory per user and per-user probabilistic anti-repeat state (Bloom filter) to suppress repeats.

## Root Folder Structure
- `app/`: Next.js application routes and API endpoints.
- `components/`: reusable UI components for web surfaces.
- `lib/`: shared logic (schemas, clients, utility helpers).
- `db/`: database schema/migration/configuration assets.
- `documentation/`: product, architecture, and subsystem docs.
- `.codex/`: agent prompts, state logs, and durable learnings.
- `tests/`: Vitest unit/integration tests.
- `public/`: static assets served by the app.
- `scripts/`: operational scripts (maintenance/backfill/setup helpers).

## Final Framework and Tooling Stack

### Core Application
- **Next.js (TypeScript)**: Single monolith for frontend and backend API routes.
- **Tailwind CSS + shadcn/ui**: UI styling and component system for the web app.
- **OAuth login (Google only in V1)**: Simple social sign-in flow for account access.

### AI and Discovery
- **Claude Sonnet 4.5**: Summary writer and reply intent parsing.
- **Exa AI**: Primary discovery API for candidate links.

### Email and Scheduling
- **Resend**: Outbound newsletter delivery and inbound reply webhooks.
- **Supabase pg_cron (every minute)**: Scheduled DB-native due-user selection via Postgres function.

### Data and Validation
- **Supabase (PostgreSQL)**: Hosted relational database.
- **Drizzle ORM**: Type-safe database access.
- **drizzle-kit**: Schema migrations.
- **zod**: Runtime validation for API and model-structured outputs.
- **date-fns + date-fns-tz**: Timezone-aware daily send logic.

### Extraction, Testing, and Reliability
- **Vitest**: Unit/integration tests.

## System Pattern
- Single monolith architecture (web + API + cron endpoints).
- Pipeline: `Exa discovery -> fetch/extract -> Claude writer -> assemble newsletter -> send via Resend`.
- User personalization is dynamic and text-based, not rigid topic-table driven.

## Critical System Risks

### 1) Over-fitting to recent feedback
- Risk: reply signals can be overweighted relative to long-term user identity.
- Example failure mode: user replies "I liked that drones article" and the next issue over-rotates to aerospace, dropping baseline interests.
- Why this is hard: balancing `core identity` vs `passing curiosity` requires stable weighting/decay policy and guardrails on one-shot updates.

### 2) 7:00 AM personalization latency bottleneck
- Risk: generating and sending thousands of highly personalized issues at one time can saturate compute and queue capacity.
- Example failure mode: at ~5,000 users targeting `07:00` local send, on-the-fly generation causes delivery delays and misses timing expectations.
- Why this is hard: this is a queueing/concurrency/orchestration problem, not just an email API problem; generation throughput must be engineered as a first-class system concern.

## System Flows

### 1) Onboarding Flow
1. User signs in with OAuth (Google only in V1).
2. User completes onboarding form:
   - one large brain-dump textbox (interests, what they are like, where they want to start, what they want to learn)
   - preferred name
   - timezone
   - preferred daily send time
3. Backend validates input and writes/updates `users`:
   - derives identity from authenticated session email
   - transforms `brain_dump_text` into canonical memory text via onboarding processor
   - stores send-time settings and identity fields
4. User is marked ready for daily generation.
5. On first successful onboarding insert, system sends standalone welcome intro email immediately, then schedules separate welcome issue send (short first issue) via lifecycle-attached `after(...)`, then continues normal daily schedule.

### 2) Daily Newsletter Generation Flow
1. Supabase `pg_cron` executes `net.http_post(...)` every minute to call `POST /api/cron/generate-next` with `CRON_SECRET`.
2. Backend reads `users.interest_memory_text`.
3. System runs discovery and applies Bloom anti-repeat gating on candidate canonical URLs before final item selection.
4. System composes final `{ title, summary, url }` item payloads.
5. System selects one personalized quote from `jstet/quotes-500k` (sample 50 deterministically per user/day, pre-filter, Claude chooses 1).
6. Newsletter template is rendered and sent via Resend.
7. Footer message includes ongoing calibration instruction (no special first-week mode), e.g. reply as much as the user wants to improve curation.
8. On successful send, sent canonical URLs are hashed into per-user Bloom state and `users.last_issue_sent_at` is updated.

### 3) Inbound Reply Update Flow
1. User replies to newsletter email.
2. Resend webhook posts inbound email to backend endpoint.
3. Backend parses reply intent with a cheaper Claude model when possible.
4. Parsed intent is merged into `users.interest_memory_text` via typed update operations against the canonical memory sections, with validation and fallback.
5. If the user does not reply, nothing is updated (system continues from existing memory).
6. Negative reply handling currently removes or demotes active interests and appends explicit feedback lines rather than writing a separate suppression section.
7. Unknown-sender replies receive a guidance auto-reply and are ignored for memory mutation.

### 4) Idempotency and Duplicate Handling
- Cron flow must be idempotent to prevent duplicate sends if a scheduled trigger runs twice.
- Inbound webhook handling must be idempotent to prevent applying the same reply update more than once.
- In-email feedback click handling is idempotent via signed token `jti` reservation in `processed_webhooks`.
- Duplicate-prevention for content is enforced via per-user Bloom membership checks before send.

## API Contracts (V1)
V1 intentionally excludes a manual regenerate endpoint.

### 1) Onboarding / Preferences
- **Endpoint**: `POST /api/onboarding`
- **Auth**: authenticated session identity (Google OAuth via Supabase auth session).
- **Purpose**: create/update user setup and initialize interest memory.
- **Request schema (zod shape)**:
  - `preferred_name: string`
  - `timezone: string`
  - `send_time_local: string` (HH:mm)
  - `brain_dump_text: string`
- **Behavior**:
  - validates payload
  - resolves authenticated session email for identity
  - creates or updates `users` row
  - persists `preferred_name` from validated payload
  - routes `brain_dump_text` through onboarding memory processor
  - persists canonical memory text (`PERSONALITY`, `ACTIVE_INTERESTS`, `RECENT_FEEDBACK`)
  - enforces hard cap of `800` words on stored memory
- **Response**:
  - `{ ok: true, user_id: string }`

### 2) Cron Trigger (Batch Claim + Send)
- **Endpoint**: `POST /api/cron/generate-next`
- **Auth**: service secret (`Authorization: Bearer ${CRON_SECRET}`).
- **Purpose**: scheduled route that claims due users in batch and runs send pipeline.
- **Request schema (zod shape)**:
  - `run_at_utc?: string` (optional override)
  - `batch_size?: number` (`1..25`, default route value `10`)
- **Behavior**:
  - calls `public.claim_due_users_batch(run_at_utc, 5, batch_size)` in Postgres
  - function computes due users from `timezone`, `send_time_local`, and `last_issue_sent_at`
  - function opens eligibility 3 minutes before configured local send time (`send_time_local_minute - 3`, clamped at local `00:00`)
  - function excludes users already sent on their current local day
  - function selects up to `batch_size` users deterministically (`last_issue_sent_at` asc nulls first, then `id` asc)
  - runs bounded-concurrency send pipeline for each claimed user
  - returns `no_due_user` when queue is empty
- **Response**:
  - `{ ok: true, status: "processed_batch", requested_batch_size: number, claimed_user_count: number, counts: { sent: number, insufficient_content: number, send_failed: number, internal_error: number }, user_results: Array<{ user_id: string, status: string, provider_message_id: string | null }> }`
  - or `{ ok: true, status: "no_due_user" }`

### 3) Inbound Reply Webhook
- **Endpoint**: `POST /api/webhooks/resend/inbound`
- **Auth**: Resend signature verification
- **Purpose**: apply reply-driven interest updates.
- **Request schema (zod shape)**:
  - provider payload fields (including sender, message id, plain text body)
- **Behavior**:
  - verifies webhook signature
  - maps sender email -> `users` row
  - loads current `interest_memory_text`
  - sends `{ current_interest_memory_text, inbound_reply_text }` to Claude with separate system + user prompts
  - Claude returns strict JSON update ops
  - applies deterministic fallback memory formatter when model output is invalid/unavailable
  - saves updated `interest_memory_text`
  - idempotent on provider message id when available (fallback `svix-id`) stored in `processed_webhooks(provider, webhook_id)`
- **Response**:
  - `{ ok: true, status: "updated", user_id: string }`
  - or `{ ok: true, status: "ignored" }` (unknown sender/empty text/already processed)

### 4) In-Email Item Feedback Click
- **Endpoint**: `GET /api/feedback/click?token=...`
- **Auth**: signed token (`HMAC` with `FEEDBACK_LINK_SECRET`)
- **Purpose**: capture one-click per-item feedback (`more_like_this` / `less_like_this`) from newsletter email links.
- **Token claims**:
  - `uid` (user id)
  - `url` (item URL)
  - `title` (item title)
  - `ft` (`more_like_this` | `less_like_this`)
  - `jti` (deterministic idempotency key)
  - `exp` (expiry)
- **Behavior**:
  - validates signature + expiry
  - reserves `processed_webhooks(provider=\"feedback_click\", webhook_id=jti)` to dedupe repeats
  - appends one explicit line to `RECENT_FEEDBACK` (`+/- [feedback_type] <title>`)
  - returns direct HTML confirmation (no redirect)
- **Response**:
  - `200` confirmation page for success or duplicate no-op
  - `400` invalid/expired token
  - `404` user not found
  - `500` processing/config error

### Error Envelope (All Endpoints)
- Standard response shape for failures:
  - `{ ok: false, error_code: string, message: string }`

## Agent Pipeline Spec
This section defines how the curation agent works to replicate a human-like curation process while staying neutral and source-grounded.

1. Read `users.interest_memory_text`.
2. Derive candidate interests/subtopics from that memory.
3. Target output is 10 items covering 10 topics per newsletter.
4. For each interest/topic:
   - run Exa discovery to gather candidate sources
   - use Claude to filter candidates down to top 3
   - use Claude to pick 1 best link from those 3
5. Backend fetches/extracts article content for each selected link:
   - default path: normal fetch/extraction
   - fallback path: Playwright rendering for hard/JS-heavy pages
6. Claude Writer generates item output:
   - item title text
   - short TLDR-style summary grounded in source phrasing
7. Repeat across topics until 10 high-quality items are assembled.
8. If fewer than 10 strong topic candidates are available, backfill with adjacent discovery topics likely to interest the user.
9. Return curated items to newsletter assembly and delivery.

### V1 Note
- V1 does not include a separate reviewer model. A reviewer loop can be added in a later version if quality control needs become stricter.

## Post-V1: Reviewer Model (Deferred)
This capability is intentionally deferred and not part of V1.

Planned behavior when enabled:
1. After Claude Writer generates each TLDR-style summary, Claude Reviewer evaluates it.
2. Reviewer rubric checks:
   - grounding to source
   - neutrality (no AI opinions/hot takes)
   - no-slop quality
   - format compliance
3. If an item fails threshold, regenerate up to 2 retries.
4. If it still fails after retries, drop and replace from remaining candidates.

Purpose:
- tighten factual and editorial quality gates beyond single-pass writer generation.

## Final Data Plan (Minimal)

### Table: `users`
Purpose: one record per user with live personalization state.

Fields:
- `id` (primary key)
- `email` (unique)
- `preferred_name`
- `timezone`
- `send_time_local`
- `interest_memory_text` (single evolving liquid profile)
- `last_issue_sent_at` (nullable delivery-state timestamp used by scheduler)

Behavior:
- On onboarding, processor output from `brain_dump_text` is saved into `interest_memory_text`.
- On each inbound reply, processor output from `{ current_interest_memory_text, inbound_reply_text }` updates `interest_memory_text` once per unique webhook event.
- Scheduler selection authority for "already sent today" is `users.last_issue_sent_at`.

### Anti-repeat Bloom State (Per User)
Purpose: compact probabilistic repeat suppression without per-item history rows.

Stored on each `users` row:
- `sent_url_bloom_bits` (base64 bitset)

Behavior:
- Before finalizing send candidates, check URL fingerprint membership in user Bloom filter.
- After successful send, set bits for all sent URL fingerprints.
- Bloom parameters are global runtime constants (not per-user DB columns).
- False positives are possible (new link may be filtered), false negatives are not expected after successful writes.
- Rotation/reset policy is required to bound false-positive rate growth over time.

### Table: `outbound_send_idempotency`
Purpose: outbound duplicate-send guard for per-user per-local-date issue sends, scoped by send variant.

Fields:
- `id` (primary key)
- `idempotency_key` (unique)
- `user_id` (foreign key -> `users.id`)
- `local_issue_date`
- `issue_variant` (`daily` | `welcome`)
- `status` (`processing` | `sent` | `failed`)
- `provider_message_id` (nullable)
- `failure_reason` (nullable)
- `created_at`
- `updated_at`

### Table: `processed_webhooks`
Purpose: inbound webhook replay guard for one-time memory updates.

Fields:
- `id` (primary key)
- `provider`
- `webhook_id`
- `processed_at`

Recommended constraints/indexes:
- Unique: (`provider`, `webhook_id`) for idempotent webhook handling.
- Index: (`processed_at`) for retention pruning.

Retention policy:
- prune rows older than 30 days via daily DB cron job (`prune-processed-webhooks-daily`) configured in `scripts/setup-supabase-cron.sql`.

## Runtime Flow with Minimal State
1. Read `users.interest_memory_text`.
2. Discover and rank candidate links.
3. Exclude likely already-sent links using per-user Bloom membership checks.
4. Generate and send the daily newsletter.
5. Update per-user Bloom state with sent URL fingerprints.
6. Parse inbound user reply and update `users.interest_memory_text`.

## Explicitly Out of Scope (Current)
- No `content_items` cache table.
- No `newsletter_runs` table.
- No `inbound_replies` history table.
- No deterministic mute-topic table.
- Exact email template character/sentence limits (to be defined in the next phase).

This keeps the architecture minimal while preserving multi-user support, dynamic personalization, and anti-repeat behavior with compact per-user state.

## Planned UX Enhancements (Post-Core Pipeline)
These are roadmap candidates after baseline send quality/reliability are stable.

1. Pre-save newsletter preview
- A lightweight preview generated from onboarding input to validate quality before first save/send.

2. Delivery status surface
- User-visible status for `last sent`, `next send`, and timezone interpretation.

3. Quick feedback controls
- Structured feedback chips (for example more/less/basic/advanced) alongside free-text replies.

4. Source preference controls
- User-level controls for source mix/strictness to tune perceived quality.

5. Onboarding templates
- Preset interest profiles to reduce cold-start friction.

6. Digest intensity controls
- User-level issue size preference (light/standard/deep) with scheduler/pipeline support.
