# File: `tests/memory-processors-reply-merge.test.ts`

## Purpose
Covers structured JSON-op reply updates and safety fallbacks.

## Covered Cases
- valid model ops merge deterministically into canonical memory
- invalid JSON output falls back deterministically
- cumulative multi-reply updates retain prior interests
- suppress -> re-enable lifecycle restores topics correctly
- conflicting active vs suppressed ops resolve deterministically (active wins)
- extra-key/injection-like payloads are schema-rejected with fallback
- non-JSON instruction-like outputs are rejected with fallback and warning logs

## Why This File Exists
- Isolates reply-mutation semantics and adversarial model-output coverage.
- Keeps file size below repo 500-LOC policy while preserving previous coverage.
