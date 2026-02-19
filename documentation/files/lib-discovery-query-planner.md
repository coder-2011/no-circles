# File: `lib/discovery/query-planner.ts`

## Purpose
Adds a small OpenRouter-backed query planning layer for discovery retrieval quality.

## Behavior
1. Accepts current `interest_memory_text` and derived topic list.
2. Prompts a lightweight model to produce one depth-focused, novelty-seeking Exa query per topic.
3. Enforces strict JSON parsing and topic-key matching against requested topics.
4. Applies deterministic guardrails on each query before returning:
- ensures the base topic phrase is present
- ensures anti-generic negative terms are present (`-tutorial -beginner -beginners -introduction -basics -101`)
5. Returns `Map<topic, query>` for discovery orchestration.

## Guardrails
- Requires `OPENROUTER_API_KEY`.
- Uses `OPENROUTER_QUERY_PLANNER_MODEL` when set; defaults to `qwen/qwen3-14b`.
- Planner can be disabled via `DISCOVERY_QUERY_PLANNER_ENABLED=0`.
- On planner failure, discovery route falls back to deterministic query construction.
