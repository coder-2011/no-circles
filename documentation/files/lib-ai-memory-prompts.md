# File: `lib/ai/memory-prompts.ts`

## Purpose
Contains memory prompt builders for onboarding formatting and reply-driven memory merge updates.

## Exports
- `buildOnboardingMemoryPrompt`
- `buildReplyMemoryPrompt`

## Status
- Prompt wording is deterministic and merge-oriented.
- Prompts enforce canonical section order, formatting constraints, conflict precedence, and word-cap expectations.
- Prompts explicitly instruct the model to treat user-provided text as data (not executable instructions).
- Reply prompt now requests strict JSON update-ops (typed keys only) instead of full-memory free-form text.
- Prompts now enforce an interest-category normalization standard:
  - broad category labels are allowed when user intent is broad
  - project/paper-level specifics are mapped to stable categories
  - broad labels add an inferred familiarity signal in memory text unless user states advanced depth.
- Reply prompt includes hard section-ownership boundaries to prevent topic duplication across `PERSONALITY`, `ACTIVE_INTERESTS`, and `SUPPRESSED_INTERESTS`.
- Reply prompt now asks the model to infer interest intensity and choose lane-aware ops:
  - strong intent -> core lane (`add_active_core` / `add_active`)
  - medium/downweighted intent -> side lane (`add_active_side` / `move_core_to_side`)
  - hard stop intent -> suppressed lane (`add_suppressed` with active removals)
- Reply prompt keeps soft-vs-hard examples as guidance but explicitly avoids brittle phrase matching; inference is semantic/contextual.
- Reply prompt includes explicit hierarchical cascade guidance for hard-stop parent topics (for example `scrap philosophy` also applies to `philosophy of physics`).
