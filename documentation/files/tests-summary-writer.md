# File: `tests/summary-writer.test.ts`

## Purpose
Verifies PR8 summary generation contract and failure handling.

## Coverage
- returns final fields only (`title`, `url`, `summary`)
- preserves fixed source URL even when model output changes title
- retries once for invalid model output
- falls back to deterministic summary after retry exhaustion
- enforces configurable summary word range behavior
- runs one model call per item
