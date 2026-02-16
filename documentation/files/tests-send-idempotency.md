# File: `tests/send-idempotency.test.ts`

## Purpose
Validates outbound idempotency key derivation semantics.

## Coverage
- key is per user + per local issue date
- timezone-aware local-date derivation
