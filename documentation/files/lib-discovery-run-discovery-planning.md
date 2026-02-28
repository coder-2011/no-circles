# File: `lib/discovery/run-discovery-planning.ts`

## Purpose
Builds the topic plan and quota allocation for a discovery run.

## Responsibilities
- derive active-topic and serendipity-topic plans from canonical memory
- preserve the legacy fallback when `ACTIVE_INTERESTS` is empty
- choose an active-topic subset when memory contains more topics than the configured max
- compute adaptive serendipity target counts based on active-interest breadth
- build per-topic quotas for core and serendipity lanes

## Notes
- The exported helpers are intentionally narrow: planning/allocation policy only.
- `run-discovery.ts` remains the orchestrator for retrieval, retries, selection, and warning emission.
