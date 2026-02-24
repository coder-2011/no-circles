# File: `tests/feedback-click-token.test.ts`

## Purpose
Validates feedback token signing and verification behavior.

## Coverage
- successful token round-trip verification
- tamper detection via signature mismatch
- expiry rejection
- click URL builder output
