# File: `proxy.ts`

## Purpose
Runs request-time Supabase auth refresh for app and API requests before server-side auth checks.

## Behavior
1. Delegates to `lib/auth/proxy.ts`.
2. Applies to all non-static routes through the exported matcher.
3. Excludes `_next` static/image assets and common file-extension requests.

## Why It Exists
Fresh OAuth sessions can otherwise lag behind the next server request, especially around callback -> onboarding transitions. This request-time auth refresh keeps server cookies aligned with the browser session and reduces false `401` responses immediately after sign-in.
