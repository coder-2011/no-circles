# File: `db/migrations/0007_calm_guardrail.sql`

## Purpose
Adds a hard safety bound on persisted Bloom bitset payload size to prevent oversized decode allocations from malformed DB values.

## Schema Changes
- adds CHECK constraint on `users.sent_url_bloom_bits`:
  - `NULL` allowed
  - otherwise `char_length(sent_url_bloom_bits) <= 10924`

## Rationale
- Runtime Bloom settings use `m=65536` bits (`8192` bytes).
- Base64 encoding for `8192` bytes is at most `10924` characters.
- Bounding stored payload length blocks pathological rows from forcing large memory allocations during decode.
