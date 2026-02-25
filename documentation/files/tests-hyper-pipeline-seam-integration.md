# File: `tests/hyper/pipeline-seam.integration.test.ts`

## Purpose
Validates PR6 -> PR8 seam under deterministic integration conditions.

## Coverage
1. Discovery output feeds summary writer and returns 10 final items.
2. URL passthrough remains fixed from discovery to final output.
3. Mixed model failure behavior:
   - one retry per item
   - failed items are dropped when retries fail quality/parse checks
   - skipped-count telemetry is logged server-side

## Artifacts
Writes per-run traces to:
- `logs/hyper/pipeline-seam/<run-id>/discovery-output.txt`
- `logs/hyper/pipeline-seam/<run-id>/summary-output.txt`
