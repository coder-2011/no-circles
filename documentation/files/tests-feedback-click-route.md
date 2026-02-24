# File: `tests/feedback-click-route.test.ts`

## Purpose
Covers click-feedback route behavior with mocked DB/idempotency dependencies.

## Coverage
- valid signed click records feedback and appends to memory
- duplicate click idempotency returns no-op success
- invalid token returns `400`
