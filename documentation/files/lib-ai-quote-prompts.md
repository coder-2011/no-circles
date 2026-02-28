# File: `lib/ai/quote-prompts.ts`

## Purpose
Defines quote-selection prompt contracts for Claude.

## Exports
- `QUOTE_SELECTION_SYSTEM_PROMPT`
- `buildQuoteSelectionUserPrompt(args)`

## Prompt Contract
- System prompt is role-only (`seasoned literary editor` curating the newsletter closing quote).
- Task instructions and output schema live in the user prompt.
- User prompt includes:
  - `PERSONALITY` context
  - `RECENT_FEEDBACK` context, with `more_like_this` / `less_like_this` treated as slight steering from clicked article titles rather than durable interests or normalized topics
  - numbered quote candidates
  - strict JSON output shape with `selected_index`.
