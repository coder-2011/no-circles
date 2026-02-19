# File: `tests/discovery-manual-eval.integration.test.ts`

## Purpose
Runs a high-signal integration-style evaluation of the discovery stage and prints final candidates for manual human/LLM review.

## What It Validates
- end-to-end discovery orchestration using realistic provider-like fixtures
- final output includes 10 candidates
- suppressed-topic candidates are excluded from final output
- candidate set has strong domain diversity and minimum score floor
- highlight text is present and non-trivial for all final candidates

## Why It Exists
Provides practical confidence beyond unit tests by exercising realistic pipeline behavior and exposing final ranked candidates for qualitative inspection.
