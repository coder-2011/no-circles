# File: `app/onboarding/page.tsx`

## Purpose
Frontend onboarding screen for authenticated users.

## Behavior
1. Reads auth state from Supabase browser client.
2. Shows signed-in/signed-out/loading states.
3. Redirects signed-out users to home after a short delay.
4. Randomizes the preferred-name placeholder suggestion from a curated famous-intellectual list on each page load.
5. Posts onboarding preferences to `POST /api/onboarding`.
6. Shows a brief, subtle success celebration near the save button on successful submit.
7. Handles success, auth expiration (`401`), and general errors with actionable UI messages.

## Form Fields
- `preferred_name`
- `timezone`
- `send_time_local`
- `brain_dump_text`
