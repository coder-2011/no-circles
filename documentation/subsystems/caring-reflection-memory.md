# Subsystem: Caring Reflection Memory Pass

## Scope
Adds a lightweight editorial self-review layer that runs inside the daily send path on a bi-daily cadence.

The subsystem is intentionally constrained:
- keep canonical memory shape unchanged
- store only the last 5 sent emails and last 5 reply emails per user
- run one Anthropic reflection call at most once every 2 user-local days for `daily` sends
- optionally rewrite `users.interest_memory_text`
- emit an ephemeral discovery brief for the current send only

## Current Implementation
- Prompt contract: `lib/ai/memory-prompts.ts`
- Reflection cadence + model runner: `lib/memory/reflection.ts`
- Recent email evidence storage/load: `lib/memory/email-history.ts`
- Send-path integration: `lib/pipeline/send-user-newsletter.ts`
- Reply-history write path: `app/api/webhooks/resend/inbound/route.ts`
- Persistence changes: `lib/db/schema.ts`, `db/migrations/0018_brisk_recall.sql`

## Persistence

### `users.last_reflection_at`
Purpose:
- records when the bi-daily review last ran, even if the model returned `no_change`

### `user_email_history`
Purpose:
- stores recent concrete evidence the reflection model can inspect

Fields:
- `user_id`
- `kind` (`sent` | `reply`)
- `subject`
- `body_text`
- `provider_message_id`
- `issue_variant`
- `created_at`

Retention:
- keep only the newest 5 rows per `user_id + kind`

## Evidence Surface
The reflection model reads:
- current canonical memory text
- last 5 sent emails
- last 5 reply emails

It does not read:
- full long-term raw history
- a dedicated click-event table
- provider-side email fetches during the reflection call

Click feedback still influences reflection indirectly through `RECENT_FEEDBACK`.

## Cadence Rule
- only for `daily` sends
- skip for `welcome` sends
- run when `last_reflection_at` is null, or the current user-local date is at least 2 days after the last reflected user-local date

## Input Contract
Reflection input is assembled in the send pipeline:
- `user_id`
- `timezone`
- `run_at_utc`
- `current_memory_text`
- `recent_sent_emails`
- `recent_reply_emails`

Sent and reply emails are passed as exact stored plain-text bodies plus optional subjects and provider ids.

## Output Contract
The model returns strict JSON with one of two decisions:

### `no_change`
- `decision: "no_change"`
- `discoveryBrief`

### `rewrite`
- `decision: "rewrite"`
- `memoryText`
- `discoveryBrief`

`memoryText` is full canonical memory text.

`discoveryBrief` contains:
- `reinforceTopics`
- `avoidPatterns`
- `preferredAngles`
- `noveltyMoves`

Only `memoryText` persists. `discoveryBrief` is ephemeral and applies only to the current send.

## Runtime Flow
1. `sendUserNewsletter(...)` loads the user.
2. It checks whether bi-daily reflection is due.
3. If due, it loads recent email evidence from `user_email_history`.
4. It runs the reflection prompt.
5. If the model returns `rewrite`, the rewritten memory is validated against canonical memory rules.
6. The pipeline persists:
   - `users.last_reflection_at`
   - optionally updated `users.interest_memory_text`
7. The current send continues using:
   - reflected or unchanged memory text
   - the ephemeral `discoveryBrief`
8. Discovery consumes the brief during:
   - query building
   - link selection
   - serendipity topic selection

## Sent Email History Writes
After provider acceptance and after outbound idempotency is marked `sent`, the send pipeline records one `sent` row containing:
- rendered subject
- rendered plain-text body
- provider message id
- issue variant

If this write fails, the pipeline logs and continues. The email has already been delivered.

## Reply Email History Writes
When the inbound reply webhook successfully mutates memory, it also records one `reply` row in the same DB transaction using:
- extracted newest reply text
- optional subject from inbound headers
- resolved provider message id when available

This keeps recent raw reply evidence aligned with the exact mutation that used it.

## Discovery Integration
Reflection does not change topic derivation or quota logic directly.

Its influence is intentionally narrow:
- stronger persistent memory when a rewrite is justified
- a small current-send discovery brief for freshness, repetition avoidance, and framing

This keeps the subsystem editorial rather than architectural.

## Guardrails
- invalid reflection JSON -> keep existing memory
- invalid canonical rewrite -> keep existing memory
- reflection failure -> keep existing memory
- no recent email history -> skip with empty discovery brief
- email evidence retention is hard-capped to 5 sent + 5 reply emails per user

## Model Selection
- primary env: `ANTHROPIC_REFLECTION_MODEL`
- fallback env: `ANTHROPIC_MEMORY_MODEL`

The design assumes a stronger model than the reply-memory merge path and is intended for Sonnet-class use.

## Non-Goals
- no new memory sections
- no persisted editorial brief
- no click-history table in this slice
- no reflection on every single send
- no broader recommender/state-machine layer
