# File: `tests/hyper/query-planner-live.integration.test.ts`

## Purpose
Provides an opt-in live integration test for the OpenRouter query planner with real model calls.

## Execution Contract
- Test is skipped by default.
- To run:
  - set `OPENROUTER_API_KEY`
  - set `RUN_LIVE_QUERY_PLANNER_TESTS=1`
  - optionally set `OPENROUTER_QUERY_PLANNER_MODEL` to choose the live model

## What It Prints
- exact planner prompt text sent to the model
- final topic-to-query output map returned by planner parsing

## Why It Exists
Enables fast qualitative review of planner prompt behavior and live query quality without running the full newsletter pipeline.
