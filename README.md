# No Circles

Website-first personalized newsletter system.

No Circles generates one daily email per user with 10 high-signal links tailored to that user's evolving interests, then updates user memory from inbound email replies.

## What It Does

- Collects onboarding context (`preferred_name`, `timezone`, `send_time_local`, `brain_dump_text`).
- Maintains one canonical per-user memory (`interest_memory_text`).
- Runs discovery and ranking to assemble 10 newsletter items.
- Uses per-user Bloom state to suppress repeated URLs.
- Sends newsletter via Resend.
- Processes inbound Resend replies and updates memory idempotently.

## Product Principles

- Curate, do not invent.
- Neutral summaries (no AI hot takes).
- Daily usefulness over stylistic flourish.
- Fast user-controlled adaptation through replies.

## Architecture At A Glance

```mermaid
flowchart LR
    U[User]
    W[Next.js Web App]
    API[API Routes]
    DB[(Supabase Postgres)]
    EXA[Exa Discovery]
    AI[Claude]
    RS[Resend]

    U --> W
    W --> API
    API --> DB
    API --> EXA
    API --> AI
    API --> RS
    RS --> API
```

## Core Runtime Flows

### 1) Onboarding

```mermaid
flowchart TD
    A[Authenticated user submits onboarding form] --> B[POST /api/onboarding]
    B --> C[Zod validation]
    C --> D[Process brain_dump_text into canonical memory]
    D --> E[Upsert users by session email]
    E --> F[Persist timezone/send_time_local/preferred_name/interest_memory_text]
```

### 2) Scheduled Send Pipeline

```mermaid
flowchart TD
    C1[Scheduler trigger] --> C2[POST /api/cron/generate-next]
    C2 --> C3[DB function claims due users]
    C3 --> C4[runDiscovery]
    C4 --> C5[Bloom anti-repeat filter]
    C5 --> C6[Final highlights + summary generation]
    C6 --> C7[Render newsletter HTML/text]
    C7 --> C8[Resend send]
    C8 --> C9[Persist last_issue_sent_at + Bloom bits + idempotency status]
```

### 3) Inbound Reply Memory Update

```mermaid
sequenceDiagram
    participant R as Resend
    participant A as /api/webhooks/resend/inbound
    participant D as Postgres
    participant M as Memory Processor

    R->>A: Signed webhook event
    A->>A: Verify Svix signature
    A->>D: Reserve idempotency key (provider+message/event)
    alt already processed
        A-->>R: { ok: true, status: "ignored" }
    else new event
        A->>D: Load user by sender email
        A->>M: Merge reply into canonical memory
        M-->>A: Updated memory text
        A->>D: Update users.interest_memory_text
        A-->>R: { ok: true, status: "updated" }
    end
```

## Tech Stack

- Next.js + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Postgres + Drizzle ORM + drizzle-kit
- Exa (discovery)
- Claude Sonnet 4.5 (summary and memory processing)
- Resend (outbound + inbound)
- zod, date-fns/date-fns-tz
- Vitest + Playwright

## Repository Layout

- `app/` - pages and API routes
- `components/` - reusable UI
- `lib/` - core services, schemas, helpers
- `db/` - schema + migrations
- `tests/` - unit/integration tests
- `e2e/` - browser tests
- `scripts/` - operational scripts
- `documentation/` - source-of-truth design/architecture docs
- `.codex/` - memory and session logs

## API Surface (Current)

- `POST /api/onboarding`
- `POST /api/cron/generate-next`
- `POST /api/webhooks/resend/inbound`
- `GET /api/deepgram/token`

## Data Model (Core)

- `users`
  - identity + personalization state (`email`, `preferred_name`, `timezone`, `send_time_local`, `interest_memory_text`)
  - delivery state (`last_issue_sent_at`)
  - anti-repeat state (`sent_url_bloom_bits`)
- `processed_webhooks`
  - inbound replay protection (`provider`, `webhook_id`)
- `outbound_send_idempotency`
  - outbound dedupe and status tracking
- `cron_selection_leases`
  - lease tracking for scheduler selection

## Environment Variables

Required (runtime):

- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `CRON_SECRET`
- `ANTHROPIC_API_KEY`
- `EXA_API_KEY`

Common optional/config vars:

- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`

## Local Development

```bash
npm install
npm run dev
```

Useful shortcuts (if you use `just`):

```bash
just install
just dev
just lint
just build
```

## Testing

```bash
npm run lint
npm run build
```

Project also includes Vitest and Playwright suites under `tests/` and `e2e/`.

## Documentation

Start here:

- `documentation/README.md`

Then read in order:

1. `documentation/vision.md`
2. `documentation/architecture.md`
3. `documentation/subsystems/db-and-onboarding.md`
4. `documentation/subsystems/inbound-reply-memory-update.md`

## Current Status

Core onboarding, scheduler/send pipeline, Resend outbound delivery, and inbound webhook memory updates are implemented. Ongoing work focuses on quality hardening, discovery quality, and operational scaling.
