# File: `db/migrations/0018_brisk_recall.sql`

## Purpose
Adds the minimal persistence needed for recent-email reflection.

## Changes
- adds `users.last_reflection_at`
- creates `user_email_history`
- constrains `user_email_history.kind` to `sent` / `reply`
- constrains `issue_variant` to `daily` / `welcome` when present
- adds FK to `users`
- adds `(user_id, kind, created_at)` index
- enables RLS on `user_email_history`
- grants service-role full access
- grants authenticated self-select access by joining back to `users.email`

## Why It Exists
The reflection pass needs durable recent evidence owned by the app:
- what the system recently sent
- what the user recently replied

This migration adds that evidence surface without changing the canonical memory model.
