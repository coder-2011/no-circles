# Taskwarrior Task-Capture Prompt

Use this when the user gives a natural-language task idea and you need to convert it into one concrete Taskwarrior item.

## Input

- One free-form user sentence/paragraph describing what they want to do.

## Output Contract

1. Rewrite input as one scoped, testable task description.
2. Pick priority (`H`, `M`, `L`) based on urgency/impact.
3. Add the task to Taskwarrior:
   - `task add project:no-circles priority:<H|M|L> "<rewritten description>"`
4. Echo back:
   - created task id
   - final task text
   - chosen priority

## Conversion Rules

- Keep one task per input unless user explicitly asks to split.
- Use concrete deliverable language (what will exist when done).
- Avoid vague verbs: "improve", "fix stuff", "cleanup".
- Include subsystem/file or user-visible outcome when possible.
- If input is broad, choose the smallest high-value executable slice.
- Do not invent due dates unless user asks.
- If blocked by another task, note dependency in description text.

## Priority Heuristic

- `H`: production risk, user-visible breakage, release blocker, or direct growth experiment.
- `M`: important quality/feature work not blocking release today.
- `L`: polish, optional optimization, or low-risk backlog.
