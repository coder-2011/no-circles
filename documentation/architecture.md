# Architecture

## Overview
This system is a website-first, email-delivered personalized newsletter product. It uses a single Next.js codebase with a minimal persistent data model. Personalization is driven by one evolving text memory per user and a per-user sent URL history to prevent repeats.

## Root Folder Structure
- `app/`: Next.js application routes and API endpoints.
- `components/`: reusable UI components for web surfaces.
- `lib/`: shared logic (schemas, clients, utility helpers).
- `db/`: database schema/migration/configuration assets.
- `documentation/`: product, architecture, and subsystem docs.
- `.codex/`: agent prompts, state logs, and durable learnings.
- `tests/`: Vitest unit/integration tests.
- `e2e/`: Playwright end-to-end tests.
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
- **Vercel Cron (every minute)**: Scheduled triggering of daily newsletter jobs.

### Data and Validation
- **Supabase (PostgreSQL)**: Hosted relational database.
- **Drizzle ORM**: Type-safe database access.
- **drizzle-kit**: Schema migrations.
- **zod**: Runtime validation for API and model-structured outputs.
- **date-fns + date-fns-tz**: Timezone-aware daily send logic.

### Extraction, Testing, and Reliability
- **Playwright**: Fallback extraction for hard pages and end-to-end UI tests.
- **Vitest**: Unit/integration tests.

## System Pattern
- Single monolith architecture (web + API + cron endpoints).
- Pipeline: `Exa discovery -> fetch/extract (Playwright fallback) -> Claude writer -> assemble newsletter -> send via Resend`.
- User personalization is dynamic and text-based, not rigid topic-table driven.

## System Flows

### 1) Onboarding Flow
1. User signs in with OAuth (Google only in V1).
2. User completes onboarding form:
   - one large brain-dump textbox (interests, what they are like, where they want to start, what they want to learn)
   - preferred name (accepted at API boundary; not persisted in current minimal DB schema)
   - timezone
   - preferred daily send time
3. Backend validates input and writes/updates `users`:
   - derives identity from authenticated session email
   - initializes `interest_memory_text` from brain dump
   - stores send-time settings and identity fields
4. User is marked ready for daily generation.

### 2) Daily Newsletter Generation Flow
1. Vercel Cron triggers the generation endpoint every minute.
2. Backend reads `users.interest_memory_text`.
3. System runs the Agent Pipeline Spec to curate and compose a high-quality issue.
4. Newsletter template is rendered and sent via Resend.
5. Footer message includes ongoing calibration instruction (no special first-week mode), e.g. reply as much as the user wants to improve curation.
6. Sent URLs/titles are saved in `newsletter_items` to prevent repeats.

### 3) Inbound Reply Update Flow
1. User replies to newsletter email.
2. Resend webhook posts inbound email to backend endpoint.
3. Backend parses reply intent with a cheaper Claude model when possible.
4. Parsed intent is merged into `users.interest_memory_text`.
5. If the user does not reply, nothing is updated (system continues from existing memory).
6. Suppression duration for topics is inferred from user language and model judgment (not a rigid fixed-duration rule).

### 4) Idempotency and Duplicate Handling
- Cron flow must be idempotent to prevent duplicate sends if a scheduled trigger runs twice.
- Inbound webhook handling must be idempotent to prevent applying the same reply update more than once.
- Duplicate-prevention for content is enforced via `newsletter_items` URL/title history before send.

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
  - sets `interest_memory_text = brain_dump_text` during onboarding
  - `preferred_name` is currently validated but not persisted in the minimal DB schema
- **Response**:
  - `{ ok: true, user_id: string }`

### 2) Cron Trigger (Single User Per Call)
- **Endpoint**: `POST /api/cron/generate-next`
- **Auth**: service secret (Vercel Cron)
- **Purpose**: generate and send newsletter for one due user at a time.
- **Request schema (zod shape)**:
  - `run_at_utc?: string` (optional override)
- **Behavior**:
  - selects one due user
  - runs Agent Pipeline Spec for that user
  - sends newsletter via Resend
  - saves sent URLs/titles in `newsletter_items`
  - returns `no_due_user` when queue is empty
- **Response**:
  - `{ ok: true, status: "sent", user_id: string }`
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
  - sends `{ current_interest_memory_text, inbound_reply_text }` to Claude with system prompt
  - Claude returns updated memory
  - saves updated `interest_memory_text`
  - idempotent on provider message id
- **Response**:
  - `{ ok: true, status: "updated", user_id: string }`
  - or `{ ok: true, status: "ignored" }` (unknown sender/empty text/already processed)

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
- `timezone`
- `send_time_local`
- `interest_memory_text` (single evolving liquid profile)

Behavior:
- On onboarding, initial brain dump is saved into `interest_memory_text`.
- On each inbound reply, parsed intent is merged into `interest_memory_text`.

### Table: `newsletter_items`
Purpose: per-user sent-item history to prevent repeated URLs/titles.

Fields:
- `id` (primary key)
- `user_id` (foreign key -> `users.id`, indexed)
- `url`
- `title`
- `sent_at`

Recommended constraints/indexes:
- Index: (`user_id`, `sent_at`)
- Unique: (`user_id`, `url`) for never-repeat behavior.
- Retention cap: keep only the latest 100 sent URLs per user; older rows are pruned.

## Runtime Flow with Minimal State
1. Read `users.interest_memory_text`.
2. Discover and rank candidate links.
3. Exclude already-sent links from `newsletter_items` (and optionally near-duplicate titles).
4. Generate and send the daily newsletter.
5. Insert sent links into `newsletter_items`.
6. Parse inbound user reply and update `users.interest_memory_text`.

## Explicitly Out of Scope (Current)
- No `content_items` cache table.
- No `newsletter_runs` table.
- No `inbound_replies` history table.
- No deterministic mute-topic table.
- Exact email template character/sentence limits (to be defined in the next phase).

This keeps the architecture minimal while preserving multi-user support, dynamic personalization, and anti-repeat behavior.
