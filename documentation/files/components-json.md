# File: `components.json`

## Purpose
shadcn/ui registry and code-generation configuration.

## Behavior
1. Sets style preset (`new-york`) and TS/RSC options.
2. Points generated styles to `tailwind.config.ts` and `app/globals.css`.
3. Defines import aliases for generated component paths.

## Why It Exists
- Makes shadcn component scaffolding deterministic across machines.
- Prevents generator defaults from drifting from repository conventions.
