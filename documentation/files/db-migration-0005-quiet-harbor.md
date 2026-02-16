# File: `db/migrations/0005_quiet_harbor.sql`

## Purpose
Removes the legacy sent-item history table after adopting Bloom-filter-based anti-repeat.

## Schema Changes
- drops `newsletter_items`

## Why It Exists
- anti-repeat authority is now per-user Bloom state, not row-per-link history.
- removes dead schema surface to reduce confusion and maintenance cost.
