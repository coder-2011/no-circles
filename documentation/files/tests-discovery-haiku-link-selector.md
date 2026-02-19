# File: `tests/discovery-haiku-link-selector.test.ts`

## Purpose
Unit coverage for per-topic Haiku selector parsing and model-call contract.

## Coverage
- Parses integer-only model output into zero-based selected index.
- Asserts selector request shape (`max_tokens`, `temperature`, and prompt contract).
- Returns `null` and avoids network call when candidate list is empty.
