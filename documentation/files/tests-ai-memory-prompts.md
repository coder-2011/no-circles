# File: `tests/ai-memory-prompts.test.ts`

## Purpose
Unit-tests memory prompt contracts for onboarding formatting and reply-memory update ops.

## Coverage
- Asserts onboarding and reply flows expose separate role-oriented system prompts.
- Verifies reply user prompt includes global memory-cap, truncation, and section-ownership constraints.
- Verifies reply decision policy covers:
  - `add_active_core`
  - `add_active_side`
  - `move_core_to_side`
  - `move_side_to_core`
  - `remove_active`
- Verifies reply prompt frames hard-stop behavior as remove-only negative handling rather than suppression-array mutation.
- Verifies onboarding user prompt keeps role framing out of the user payload while enforcing canonical section order and hard length limits.
