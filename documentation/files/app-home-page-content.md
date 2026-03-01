# File: `app/home-page-content.ts`

## Purpose
Holds static content data for the public homepage so `app/page.tsx` can stay focused on client auth and page behavior.

## Behavior
1. Exports the fallback sample daily brief items used before `GET /api/sample-brief` succeeds or when it fails.
2. Exports the longer, less-technical intro and descriptor copy shown on the public `How It Works` page.
3. Exports the shared `SampleBriefItem` type so the page and fetched API response stay aligned.

## Why It Exists
- Keeps large static homepage copy out of the already-large client page file.
- Makes homepage content updates lower-risk without touching auth or interaction logic.
