# File: `app/onboarding/onboarding-config.ts`

## Purpose
Holds onboarding constants and small pure utilities used by the page controller and form.

## Contents
- shared UI/data constants:
  - word-limit + localStorage draft key
  - onboarding prefs draft key + schema version
  - curated timezones
  - quick-spark suggestions
  - quick-sparks deck key + visible/drawer batch sizes
  - preferred-name placeholder suggestions
  - Deepgram warmup constants (token fallback TTL, token-reuse safety window, warmup cooldown)
- email-name inference pattern for `first.last` / `first_last` / `first-last`
- onboarding state types:
  - `AuthState`
  - `SubmitState`
- pure helpers:
  - `countWords`
  - `truncateToWordLimit`
  - `parseSendTime`
  - `buildSendTime`
  - `getPreferredNameFromEmail` for lightweight suggested-name inference
  - `getPreferredNameFromOAuthProfile` for persisted preferred-name inference from OAuth profile metadata
  - `getDetectedTimezone` + `buildTimezoneOptions` for browser timezone defaults
  - `initialSendTimeFromLocalNow` for fixed onboarding default send-time (`08:00` local)
  - `isLegacyAutoDefaultSendTimeDraft` for onboarding prefs draft migration from old unschematized `6:00 PM` auto-defaults
  - `shuffleQuickSparks` for non-repeating deck batching
  - `resolveDeepgramTokenExpiryAtMs` for token cache expiry normalization
  - `isDeepgramTokenUsable` for safety-window-aware token reuse checks
  - `shouldWarmupDictation` for optimistic warmup eligibility gating
