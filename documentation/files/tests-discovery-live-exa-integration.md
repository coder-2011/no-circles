# File: `tests/discovery-live-exa.integration.test.ts`

## Purpose
Runs an opt-in live discovery quality evaluation against the real Tavily-backed pipeline.

## Execution Contract
- Test is skipped by default.
- To run it, set:
  - `RUN_LIVE_TAVILY_TESTS=1` (or legacy `RUN_LIVE_EXA_TESTS=1`)
  - `TAVILY_API_KEY` (valid key)

## What It Validates
- discovery returns a minimum candidate count from live provider output
- final candidates exclude suppressed topics
- minimum topic/domain diversity thresholds hold
- highlight coverage and low-signal-source ratio meet quality gates
- `diversityCard.passes` remains true under live conditions

## Why It Exists
Keeps live-provider quality visible without breaking default local/CI test runs in environments that do not expose provider secrets.
