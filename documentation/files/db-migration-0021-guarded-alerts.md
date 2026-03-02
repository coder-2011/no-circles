# Migration: `db/migrations/0021_guarded_alerts.sql`

## Purpose
Enables row-level security on `admin_alert_state` and restores the server-only access pattern the runtime expects.

## What It Changes
- enables RLS on `admin_alert_state`
- adds `admin_alert_state_service_role_all`
- keeps access limited to `service_role`

## Why It Exists
- `admin_alert_state` is internal operational state used only by server-side admin alert dedupe/cooldown logic
- the table should follow the same deny-by-default posture as the other active runtime tables
- no authenticated end-user access is required for this table
