# File: `lib/admin/provider-monitoring.ts`

## Purpose
Collects provider health, usage, and cost snapshots for the admin monitor digest.

## Providers Covered
- `anthropic`
  - uses official usage and cost admin APIs
- `exa`
  - uses official API-key usage endpoint
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
- daily digest rendering is also owned here so the admin monitor route stays thin
