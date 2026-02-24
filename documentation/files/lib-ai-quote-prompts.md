# File: `lib/ai/quote-prompts.ts`

## Purpose
Defines quote-selection prompt contracts for Claude.

## Exports
- `QUOTE_SELECTION_SYSTEM_PROMPT`
- `buildQuoteSelectionUserPrompt(args)`

## Prompt Contract
- System prompt is role-only (quote curator role).
- Task instructions and output schema live in the user prompt.
- User prompt includes:
  - `PERSONALITY` context
  - `RECENT_FEEDBACK` context
  - numbered quote candidates
  - strict JSON output shape with `selected_index`.
