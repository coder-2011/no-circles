# File: `app/api/cron/generate-next/route.ts`

## Purpose
Cron-trigger API placeholder for newsletter generation scheduling flow.

## Input Contract
- Validates request body with `cronGenerateNextSchema`.
- Accepts optional `run_at_utc` ISO datetime override.

## Behavior
1. Parses JSON body (`{}` fallback on malformed JSON).
2. Returns `400 INVALID_PAYLOAD` on schema failure.
3. Returns `{ ok: true, status: "no_due_user" }` when no due-user logic is run.

## Why It Exists
- Preserves stable endpoint contract while generation pipeline implementation is pending.
- Keeps cron integration surface available without mixing unrelated PR scope.
