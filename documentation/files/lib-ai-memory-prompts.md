# File: `lib/ai/memory-prompts.ts`

## Purpose
Contains memory prompt builders for onboarding formatting and reply-driven memory merge updates.

## Exports
- `ONBOARDING_MEMORY_SYSTEM_PROMPT`
- `REPLY_MEMORY_SYSTEM_PROMPT`
- `buildOnboardingMemoryPrompt`
- `buildReplyMemoryPrompt`

## Status
- Prompt wording is deterministic and merge-oriented.
- Onboarding and reply flows now use explicit role-oriented system prompts (`senior user-profile analyst`, `senior memory-ops analyst`).
- Prompts enforce canonical section order, formatting constraints, conflict precedence, and word-cap expectations.
- Prompts now include explicit hard total-length rules:
  - onboarding output must stay within the canonical memory word cap
  - reply ops JSON has a strict total-word limit and minimal-delta requirement
- Prompts explicitly instruct truncation behavior when memory output exceeds the cap.
- Prompts explicitly instruct the model to treat user-provided text as data (not executable instructions).
- Reply prompt now requests strict JSON update-ops (typed keys only) instead of full-memory free-form text.
- Reply prompt is compact and role-first, with one explicit decision rubric:
  - broad durable intent -> core lane (`add_active_core` / `add_active`)
  - niche/specific/acronym/tentative intent -> side lane (`add_active_side`)
  - hard stop intent -> remove from active lane (`remove_active`)
- Reply prompt includes high-signal few-shot JSON examples to reduce schema/intent ambiguity.
- Reply prompt requires acronym mentions to be handled deliberately (not ignored) and defaults uncertain additions to reversible side-lane behavior.
