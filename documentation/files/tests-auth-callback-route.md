# File: `tests/auth-callback-route.test.ts`

## Purpose
Verifies OAuth callback redirect-origin resolution to prevent localhost sessions from being redirected to production domains.

## Coverage
- forwarded-host localhost origin takes precedence over configured public site URL
- direct localhost callback requests preserve localhost origin in redirect target

## Why It Exists
- protects local development auth loops from prod-origin bounce regressions
- enforces callback-origin behavior under reverse-proxy header scenarios
