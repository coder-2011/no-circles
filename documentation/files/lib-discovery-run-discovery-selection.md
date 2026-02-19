# File: `lib/discovery/run-discovery-selection.ts`

## Purpose
Holds pure helper logic used by discovery orchestration so `run-discovery.ts` stays focused and under file-size policy.

## Responsibilities
- Candidate normalization from provider results (`url`, `title`, `highlight`, score fields).
- Canonical URL dedupe and winner preference rules.
- Soft-suppression filtering and domain-cap selection helpers.
- Quality filtering:
  - required `title` + `highlight`
  - low-signal source/domain rejection
  - low-signal hub/index/tag path rejection
  - minimum score rejection for scored candidates.
- Strict one-winner-per-topic selection using weighted topic-local score.
- Early-stop policy checks (domain diversity, score, highlight coverage).
- Diversity card computation and threshold pass/fail.
- Attempt-query expansion helper.

## Notes
- This file is intentionally side-effect free and deterministic for testability.
- `run-discovery.ts` remains the only orchestration entrypoint used by callers.
