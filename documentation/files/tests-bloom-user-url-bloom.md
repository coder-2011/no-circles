# File: `tests/bloom-user-url-bloom.test.ts`

## Purpose
Validates Bloom utility correctness for deterministic hashing, membership, add behavior, false-positive estimation, and rotation threshold handling.

## Coverage
- deterministic index generation
- membership false-before/true-after add
- deterministic multi-url bit updates
- false-positive estimate sanity as count grows
- rotation when threshold exceeded
