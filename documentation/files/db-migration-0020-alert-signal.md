# Migration: `db/migrations/0020_alert_signal.sql`

## Purpose
Adds the minimal persistence needed for admin alert dedupe and daily digest suppression.

## What It Changes
- creates `public.admin_alert_state`
- stores one row per alert key
- tracks:
  - alert kind
  - most recent send time
  - send count
  - last payload hash

## Why It Exists
- prevents identical error loops from sending the admin hundreds of emails
- prevents the daily admin digest from sending more than once per day
- avoids introducing a larger analytics/history schema for this internal monitoring feature
