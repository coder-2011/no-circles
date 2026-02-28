# File: `db/migrations/0017_clean_variant.sql`

## Purpose
Separates outbound send idempotency rows by send variant so welcome issues cannot collide with daily issues.

## Changes
- adds `outbound_send_idempotency.issue_variant`
- backfills existing rows to `daily`
- sets default `issue_variant = 'daily'`
- enforces `NOT NULL` on `issue_variant`

## Rationale
- prevents onboarding `welcome` sends from blocking later `daily` sends on the same local date
- allows sample-brief queries to filter to real daily issues instead of accidentally selecting welcome traffic
