# File: `app/onboarding/onboarding-config.ts`

## Purpose
Holds onboarding constants and small pure utilities used by the page controller and form.

## Contents
- shared UI/data constants:
  - word-limit + localStorage draft key
  - curated timezones
  - quick-spark suggestions
  - preferred-name placeholder suggestions
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
  - `getDetectedTimezone` + `buildTimezoneOptions` for browser timezone defaults
  - `initialSendTimeFromLocalNow` for no-permission local send-time default
