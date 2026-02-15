# LEARNINGS

Purpose: concise durable memory for non-trivial bug fixes, environment fixes, and architecture decisions.

## Entry Format
`[TIMESTAMP] | TYPE: {BUG_FIX|ENV_FIX|ARCH_DECISION|WORKFLOW} | AREA: {subsystem/file} | ISSUE: {what went wrong} | FIX: {what changed} | IMPACT: {why it matters}`

## Entries
[2026-02-15T08:03:28Z] | TYPE: ARCH_DECISION | AREA: Product architecture | ISSUE: Needed a minimal but multi-user full-stack plan for personalized newsletter generation. | FIX: Finalized Next.js + TS, Supabase/Postgres, Drizzle, Exa, Claude Sonnet 4.5, Resend, Vercel Cron, Playwright, Vitest; deferred reviewer model to Post-V1. | IMPACT: Clear implementation baseline with low ambiguity.

[2026-02-15T08:03:28Z] | TYPE: ARCH_DECISION | AREA: Data model | ISSUE: Early schema ideas were too heavy for V1. | FIX: Reduced to minimal tables (`users`, `newsletter_items`) and text-first liquid memory updates. | IMPACT: Faster build, lower operational overhead, still supports anti-repeat behavior.

[2026-02-15T08:03:28Z] | TYPE: ARCH_DECISION | AREA: Scheduling/delivery | ISSUE: Needed clear delivery semantics and idempotency boundary. | FIX: Cron endpoint processes one due user per call; Vercel Cron every minute; duplicate protection required for cron and webhook paths. | IMPACT: Predictable scheduling and lower risk of duplicate sends/updates.
