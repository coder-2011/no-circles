# File: `lib/discovery/query-planner.ts`

## Purpose
Adds a small OpenRouter-backed query planning layer for discovery retrieval quality.

## Behavior
1. Accepts current `interest_memory_text` and derived topic list.
2. Prompts a lightweight model to produce one depth-focused, novelty-seeking, creativity-forward provider query per topic.
3. Enforces strict JSON parsing and topic-key matching against requested topics.
4. Applies deterministic guardrails on each query before returning:
- ensures the base topic phrase is present
5. Returns `Map<topic, query>` for discovery orchestration.
6. Adds per-run creativity directives (entropy token + sampled lens/style/operator sets) so planner phrasing/keywords vary across runs.

## Guardrails
- Requires `OPENROUTER_API_KEY`.
- Uses `OPENROUTER_QUERY_PLANNER_MODEL` when set; defaults to `qwen/qwen3-14b`.
- Uses planner generation controls tuned for diversity by default:
  - `temperature=1.25`
  - `top_p=0.95`
  - `frequency_penalty=0.45`
  - `presence_penalty=0.65`
- These knobs can be overridden via:
  - `OPENROUTER_QUERY_PLANNER_TEMPERATURE`
  - `OPENROUTER_QUERY_PLANNER_TOP_P`
  - `OPENROUTER_QUERY_PLANNER_FREQUENCY_PENALTY`
  - `OPENROUTER_QUERY_PLANNER_PRESENCE_PENALTY`
- Planner can be disabled via `DISCOVERY_QUERY_PLANNER_ENABLED=0`.
- On planner failure, discovery route falls back to deterministic query construction.
