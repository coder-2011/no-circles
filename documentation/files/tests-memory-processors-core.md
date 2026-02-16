# File: `tests/memory-processors-core.test.ts`

## Purpose
Covers memory-contract, fallback-formatter, and onboarding-model requirement behavior.

## Covered Cases
- canonical section-header acceptance and normalization
- 800-word cap enforcement
- onboarding fallback canonical format and cap safety
- reply fallback canonical format and suppression-text retention
- onboarding formatter error behavior:
  - missing model env (`ONBOARDING_MODEL_REQUIRED`)
  - model auth failure (`ANTHROPIC_AUTH_FAILED`)
  - unavailable model output path (`ONBOARDING_MODEL_REQUIRED`)

## Why This File Exists
- Keeps contract/fallback/onboarding checks isolated from reply-merge mutation tests.
- Keeps file size below repo 500-LOC policy while preserving previous coverage.
