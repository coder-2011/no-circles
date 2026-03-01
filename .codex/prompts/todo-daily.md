# TODO.md Daily Execution Prompt

Use this sequence at the start of a coding session:

1. Read root `TODO.md`.
2. Pick the top actionable unchecked item.
3. Restate it as a one-line execution objective.
4. If the user introduced a new task in chat, add it to `TODO.md` in the same turn.
5. When work completes, flip the matching checkbox to `- [x]`.

Rules:
- Keep the file as the single live task tracker.
- Prefer small tasks that map cleanly to one scoped change.
- Split oversized items before implementing them.
