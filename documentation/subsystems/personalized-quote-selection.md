# Subsystem: Personalized Quote Selection

## Scope
Adds one personalized quote to the end of every newsletter issue.

## Current Implementation
- Prompt role + user task contract: `lib/ai/quote-prompts.ts`
- Runtime selector: `lib/quotes/select-personalized-quote.ts`
- Pipeline integration: `lib/pipeline/send-user-newsletter.ts`
- Renderer integration: `lib/email/render-newsletter.ts`
- Unit tests: `tests/ai-quote-prompts.test.ts`, `tests/quote-selection.test.ts`
- Live test: `tests/hyper/quote-selection-live.integration.test.ts`

## Runtime Contract
1. Pipeline computes deterministic sample seed from `user_id + local_issue_date`.
2. Selector pulls one Hugging Face rows batch (`length=50`) from `jstet/quotes-500k`.
3. Selector applies lightweight pre-filtering (quote length bounds, non-empty author, dedupe).
4. Selector sends up to `20` shortlisted quotes to Claude with:
   - role-only system prompt
   - task/output contract in user prompt
   - reader context from `PERSONALITY` + `RECENT_FEEDBACK`.
5. Claude returns one `selected_index` and selector emits one quote payload.
6. Renderer appends quote block to HTML + plain text newsletter outputs.

## Failure/Fallback Behavior
- If Hugging Face fetch fails, selector returns a static local fallback quote.
- If model call fails or returns invalid output, selector falls back to first shortlist item.
- Quote selection failures do not fail the send pipeline.

## Key Assumptions
- Runtime direct fetch from Hugging Face is acceptable for initial version.
- Deterministic per-user/day sampling is sufficient for retry stability.
- No dedicated quote-repeat history table is required in this initial version.
