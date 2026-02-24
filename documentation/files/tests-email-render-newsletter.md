# File: `tests/email-render-newsletter.test.ts`

## Purpose
Verifies newsletter renderer output shape and greeting fallback behavior.

## Coverage
- subject/html/text generation
- expected item block count
- preferred-name fallback to safe default when missing
- serendipity marker rendering in html/text
- optional personalized quote block rendering in html/text
- optional per-item in-email feedback action links in html/text
