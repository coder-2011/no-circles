# File: `tests/discovery-topic-derivation.test.ts`

## Purpose
Verifies topic derivation correctness and edge-case behavior.

## Coverage
- Unique topic extraction from `ACTIVE_INTERESTS`
- Topic-focused query generation (`query === topic`)
- Soft suppression ordering behavior
- Invalid/missing-topic memory handling and seed-topic fallback
