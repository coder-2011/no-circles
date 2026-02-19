# File: `public/onboarding-quick-sparks.txt`

## Purpose
Provides a large rotating pool of onboarding quick-spark prompts for the brain-dump helper chips.

## Format
- Plain text file
- One suggestion per line
- Current size: 1000 suggestions

## Runtime Use
1. `useOnboardingController` fetches this file on client load.
2. Lines are trimmed and empty lines are dropped.
3. A rotation cursor in localStorage selects the next visible window of chips.
4. Cursor advances by the visible chip count so subsequent reloads rotate through the full pool.

## Fallback
If fetch fails or content is empty, the onboarding UI falls back to static in-code spark defaults.
