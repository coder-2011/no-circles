# File: `tests/hyper/quote-selection-live.integration.test.ts`

## Purpose
Live integration test for quote selection against real external services.

## Runtime Contract
- Requires `ANTHROPIC_API_KEY` and one quote-capable model env (`ANTHROPIC_QUOTE_MODEL` or fallback summary/memory model).
- Calls `selectPersonalizedQuote(...)` with real Hugging Face dataset fetch and real Claude selection.
- Asserts selected quote and author are non-empty.
- Writes run artifact under `logs/hyper/pipeline-seam/*`.
