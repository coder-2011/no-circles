# Serendipitous Encounters

Personalized daily newsletter system that curates 10 high-signal links from a user’s evolving interests, sends them by email, and updates user interest memory from inbound replies.

## Status
Planning and architecture are defined. Implementation is in progress.

## Core Behavior (V1)
- User signs in with Google OAuth.
- User provides one brain-dump interest profile, timezone, and preferred send time.
- System generates a daily newsletter with 10 curated items.
- System avoids repeating previously sent URLs.
- User can reply by email; reply text updates `interest_memory_text`.

## Stack (Current)
- Next.js + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Postgres + Drizzle ORM + drizzle-kit
- Exa (discovery)
- Claude Sonnet 4.5 (summary writing + reply parsing)
- Resend (outbound + inbound)
- Vercel + Vercel Cron (every minute)
- zod, date-fns/date-fns-tz, Playwright, Vitest

## Root Folder Structure
- `app/`: Next.js pages and API routes.
- `components/`: reusable UI components.
- `lib/`: shared application logic, schemas, and service helpers.
- `db/`: database-related code and migration/config artifacts.
- `documentation/`: product/architecture documentation.
- `.codex/`: agent memory, prompts, and session state.
- `tests/`: Vitest unit/integration tests.
- `e2e/`: Playwright end-to-end tests.
- `public/`: static assets served by Next.js.
- `scripts/`: operational and maintenance scripts.

## Documentation
Start in `documentation/README.md`.

Key docs:
- `documentation/vision.md`
- `documentation/architecture.md`

## Development Workflow
- Branch-per-feature/subsystem.
- Micro commits on each branch.
- Open PR after feature + testing are complete.
- Keep CI green before merge.

## Notes
- V1 does not include a separate reviewer model.
- Reviewer loop is documented as Post-V1 in `documentation/architecture.md`.
