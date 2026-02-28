# File: `tests/send-user-newsletter-reflection-simulation.test.ts`

## Purpose
Provides a deterministic seam test for the caring-reflection loop across multiple sends.

## What It Covers
- simulates three daily sends across a bi-daily reflection cadence
- verifies reflection runs on day 1 and day 3, but not day 2
- verifies a reflection rewrite is persisted and reused on the intervening send
- verifies `discoveryBrief` reaches discovery only on runs where reflection executes
- verifies recent sent-email history from earlier sends is fed back into later reflection runs

## Why It Exists
The caring system is hard to reason about from isolated unit tests alone because the important behavior is cross-run:
- memory may be rewritten
- the rewrite changes later discovery inputs
- sent emails become future reflection evidence

This test gives a compact end-to-end simulation of that loop without needing live external services.
