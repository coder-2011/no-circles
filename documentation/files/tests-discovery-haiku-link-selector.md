# File: `tests/discovery-haiku-link-selector.test.ts`

## Purpose
Unit coverage for per-topic Haiku selector parsing and model-call contract.

## Coverage
- Parses JSON selector output into zero-based selected index, including explicit `NULL`.
- Asserts selector request shape (`max_tokens`, `temperature`, `system`, and user-prompt contract).
- Returns `null` and avoids network call when candidate list is empty.
