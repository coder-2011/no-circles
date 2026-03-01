# TODO.md Task-Capture Prompt

Use this when the user gives a natural-language task and you need to maintain root `TODO.md`.

## Output Contract

1. Rewrite the request as one or more small, concrete tasks only when needed.
2. Add each pending task to the most relevant section in `TODO.md`, or leave the file minimally sectioned if extra grouping is not useful.
3. Use markdown checkboxes:
   - pending: `- [ ]`
   - completed: `- [x]`
4. Update `TODO.md` silently in the same turn as the response or code change.

## Conversion Rules

- Prefer one scoped task per user request unless the request clearly contains multiple deliverables.
- Keep tasks specific, testable, and outcome-oriented.
- Avoid vague entries such as "improve things" or "fix stuff".
- If headings are used, prefer normal repo-relevant headings such as `Product`, `Frontend`, `Backend`, `Infra`, or `Ops`.
- Do not create duplicate tasks when an equivalent open task already exists.
