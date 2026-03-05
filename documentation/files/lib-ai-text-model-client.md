# File: `lib/ai/text-model-client.ts`

## Purpose
Provides one shared Anthropic-compatible text-model transport for the app's prompt-driven LLM tasks.

## Responsibilities
- prefer OpenRouter when `OPENROUTER_API_KEY` is configured
- fall back to direct Anthropic when only `ANTHROPIC_API_KEY` is configured
- retry once against direct Anthropic when the preferred OpenRouter request fails with `401`/`403` and an Anthropic key is available
- send one Anthropic-compatible `POST /v1/messages` request with separated `system` and `user` prompts
- normalize model lookup across multiple env names
- normalize auth, HTTP, invalid-response, and empty-response failures into stable error codes chosen by each caller
- extract plain text from Anthropic-compatible content blocks

## Notes
- This file is transport-only. Prompt construction, retries, validation, and task-specific fallback behavior remain in the calling modules.
- OpenRouter is used through its Anthropic-compatible messages surface so existing prompt/response handling can stay almost unchanged.
- Callers intentionally keep their legacy error-code names for minimal migration churn even when requests are routed through OpenRouter.
- The OpenRouter-auth fallback is intentionally narrow: only provider-auth failures trigger the Anthropic retry, so normal HTTP/model errors still surface to the caller unchanged.
