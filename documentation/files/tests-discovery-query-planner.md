# File: `tests/discovery-query-planner.test.ts`

## Purpose
Provides an isolated test harness for query planner behavior without running the full discovery stack.

## Coverage
- planner enable/disable gating via environment variables
- OpenRouter response parsing and normalization
- topic allowlisting (only requested topics are kept)
- duplicate-topic handling and query length truncation
- planner HTTP error propagation
- invalid response-shape failure handling
