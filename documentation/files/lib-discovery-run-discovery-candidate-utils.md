# File: `lib/discovery/run-discovery-candidate-utils.ts`

## Purpose
Centralizes candidate normalization and score-normalization helpers used by discovery selection.

## Responsibilities
- canonicalize raw URLs before candidate-level dedupe
- derive normalized source domains
- normalize highlight-score arrays from retrieval results
- compute representative highlight scores
- normalize score ranges for per-topic comparisons
- build normalized `DiscoveryCandidate` objects from raw search results
- compute combined topic-selection scores from Exa and highlight signals

## Notes
- This file extracts pure candidate math and URL cleanup from selection logic so `run-discovery-selection.ts` can focus on filtering and diversity policy.
- No retrieval or model calls happen here.
