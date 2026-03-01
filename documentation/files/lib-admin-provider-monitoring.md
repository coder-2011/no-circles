# File: `lib/admin/provider-monitoring.ts`

## Purpose
Collects provider health, usage, and cost snapshots for the admin monitor digest.

## Providers Covered
- `anthropic`
  - uses official usage and cost admin APIs
- `exa`
  - uses official API-key usage endpoint
  - prefers `EXA_SERVICE_API_KEY`, but falls back to `EXA_API_KEY`
  - prefers `EXA_USAGE_API_KEY_ID`, otherwise tries to resolve the key id from Exa's key-list endpoint
  - if multiple Exa keys exist, `EXA_USAGE_API_KEY_ID` or `EXA_USAGE_API_KEY_NAME` disambiguates
- `deepgram`
  - uses official usage, billing breakdown, and balances endpoints
- `resend`
  - uses official quota/rate-limit response headers from a lightweight authenticated probe
- `perplexity`
  - intentionally reports billing as unavailable because no billing poll is wired in

## Output
- returns one normalized snapshot per provider with:
  - `level`
  - `summary`
  - `usageSummary`
  - `costSummary`
  - `details[]`

## Notes
- threshold values are env-driven
- when a provider API is not configured or unavailable, the snapshot degrades to `unavailable` or `error` instead of crashing the caller
- Anthropic monitoring falls back from `ANTHROPIC_ADMIN_API_KEY` to `ANTHROPIC_API_KEY` so a single admin-capable key can be reused
- daily digest rendering is also owned here so the admin monitor route stays thin
