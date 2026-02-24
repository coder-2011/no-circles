# Taskwarrior Daily Execution Prompt

Use this sequence at the start of a coding session:

1. `task project:no-circles next`
2. Pick the top actionable task and restate it as a one-line execution objective.
3. If missing, create a scoped task:
   - `task add project:no-circles "<specific deliverable>"`
4. During execution, keep status in task notes or split large work into subtasks.
5. At completion:
   - `task <id> done`
6. If blocked:
   - add blocker note and set waiting/defer metadata.

Rules:
- Keep tasks concrete and testable.
- One task should map to one scoped commit/PR when possible.
- Avoid vague tasks ("fix stuff", "cleanup").
