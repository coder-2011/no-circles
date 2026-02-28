# File: `tests/quote-selection.test.ts`

## Purpose
Unit-tests deterministic quote sampling and selection behavior.

## Coverage
- Deterministic Hugging Face batch offset for `user_id + local_issue_date`.
- Claude selection output parsing and quote pick behavior.
- Fallback to first filtered candidate when model call is unavailable.
- Overlong raw dataset rows are excluded before shortlist/model selection.
