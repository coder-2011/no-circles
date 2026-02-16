# File: `lib/bloom/user-url-bloom.ts`

## Purpose
Implements per-user Bloom filter utilities for canonical URL anti-repeat behavior.

## Exports
- `normalizeBloomStateFromUserRow(...)`
- `canonicalUrlHashIndices(...)`
- `mightContainCanonicalUrl(...)`
- `addCanonicalUrls(...)`
- `estimateFalsePositiveRate(...)`
- `maybeRotate(...)`
- `encodeBloomBitsBase64(...)`

## Policy
- defaults: `m=65536`, `k=7`
- key input: canonical URL string
- rotation threshold default: `2%` estimated false-positive rate
- count is derived from bit occupancy (`popcount`) via inverse Bloom formula, not insertion counters
- oversized persisted base64 payloads are treated as invalid and normalized to an empty bounded buffer
