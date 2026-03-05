# File: `tests/ai-text-model-client.test.ts`

## Purpose
Protects the shared Anthropic-compatible text-model transport against provider-routing regressions.

## Coverage
- verifies OpenRouter remains the preferred provider when configured
- verifies a `401` from OpenRouter retries once against direct Anthropic when an Anthropic key is present
- verifies the original auth error still surfaces when no Anthropic fallback key exists

## Why It Matters
- live tasks such as onboarding-memory generation, summaries, selectors, quotes, and reflection all share this transport
- a bad preferred-provider credential should not unnecessarily break those paths when a valid direct Anthropic fallback is already configured
