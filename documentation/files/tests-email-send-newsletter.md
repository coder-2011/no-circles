# File: `tests/email-send-newsletter.test.ts`

## Purpose
Verifies Resend send wrapper retry and result normalization.

## Coverage
- successful first attempt
- retry-once then success
- failure after two attempts returns `ok: false`
