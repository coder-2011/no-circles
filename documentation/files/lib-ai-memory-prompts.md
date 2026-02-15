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
