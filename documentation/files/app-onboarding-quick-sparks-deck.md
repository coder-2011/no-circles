# File: `app/onboarding/quick-sparks-deck.ts`

## Purpose
Holds pure helper functions for parsing, restoring, and drawing the onboarding quick-sparks deck.

## Responsibilities
- parse the fetched quick-sparks text file into trimmed items
- restore `unseen` and `seen` deck state from persisted localStorage JSON
- discard invalid or duplicate persisted entries when the source list changes
- reshuffle exhausted seen items back into the unseen pool
- draw a non-repeating batch while preserving existing deck semantics

## Notes
- This file is intentionally pure so the controller hook can keep React state and browser storage concerns separate from deck mechanics.
- Randomization still uses `shuffleQuickSparks` from onboarding config, so deck behavior remains consistent.
