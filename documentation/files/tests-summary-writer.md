# File: `tests/summary-writer.test.ts`

## Purpose
Verifies PR8 summary generation contract and failure handling.

## Coverage
- returns final fields only (`title`, `url`, `summary`)
- preserves fixed source URL even when model output changes title
- retries once for non-quality model failures
- drops item on strict quality failures (`INSUFFICIENT_SOURCE_DETAIL`, placeholder output, missing highlights)
- enforces configurable summary word range behavior
- runs one model call per item
