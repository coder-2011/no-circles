# File: `db/migrations/0001_sturdy_ion.sql`

## Purpose
Adds inbound webhook idempotency persistence for PR3.

## Schema Changes
- creates `processed_webhooks`
- adds unique index on `(provider, webhook_id)`
- adds index on `processed_at`

## Why It Exists
- Enforces one-time processing for replayed inbound webhook events.
- Supports retention pruning queries over processed webhook history.
