# Subsystem: Send and Bloom Delivery (PR9)

## Scope
Implements real one-user-per-tick delivery runtime after scheduler selection.

## Responsibilities
- apply Bloom anti-repeat gating on discovery candidates (`canonicalUrl`)
- enforce quality-first send policy (target `10`, welcome `5`; low-context entries are dropped instead of padded)
- select one personalized quote per issue (HF batch pull + Claude pick)
- render and send newsletter via Resend with retry-once behavior
- update delivery state and Bloom state after successful send
- guard duplicates with outbound idempotency key (per user per local date)

## Contracts
- input from scheduler: selected `user_id`
- summary item contract preserved: `{ title, summary, url }`
- renderer now accepts optional `quote` payload (`text`, `author`, `category`)
- render variants supported: `daily` and `welcome`
- cron route status mapping: `sent`, `insufficient_content`, `send_failed`, `no_due_user`, `internal_error`
- idempotency reserve outcomes:
  - `claimed` / `retryable_failed_claimed` -> send proceeds
  - `already_sent` -> pipeline returns `sent` without provider resend
  - `already_processing` -> pipeline returns `send_failed` (`IDEMPOTENCY_ALREADY_PROCESSING`)
