# File: `app/onboarding/onboarding-config.ts`

## Purpose
Holds onboarding constants and small pure utilities used by the page controller and form.

## Contents
- shared UI/data constants:
  - word-limit + localStorage draft key
  - curated timezones
  - quick-spark suggestions
  - preferred-name placeholder suggestions
- onboarding state types:
  - `AuthState`
  - `SubmitState`
- pure helpers:
  - `countWords`
  - `truncateToWordLimit`
  - `parseSendTime`
  - `buildSendTime`
