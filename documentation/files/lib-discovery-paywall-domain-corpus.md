# File: `lib/discovery/paywall-domain-corpus.ts`

## Purpose
Loads the vendored BPC-derived paywall domain corpus and exposes normalized lookup helpers for discovery filtering.

## Behavior
1. Imports the generated corpus bundle from `lib/discovery/paywall-domain-corpus.generated.json`.
2. Normalizes hostnames by lowercasing, stripping `www.`, and rejecting malformed values.
3. Supports optional env overrides:
   - `DISCOVERY_PAYWALL_BLOCK_DOMAINS`
   - `DISCOVERY_PAYWALL_ALLOW_DOMAINS`
4. Returns a scored domain signal (`blocked_override`, `allowed_override`, `bpc_default`, `bpc_updated`, `bpc_custom`, or `none`).
5. Exposes corpus counts and a simple known-domain membership helper.

## Notes
- The BPC corpus is treated as a strong prior, not as an unconditional hard-block list by itself.
- Hard block behavior only comes from explicit override envs unless page-level evidence also pushes the score over threshold.
