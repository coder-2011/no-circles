Commit and push all current local changes (tracked, untracked, and unstaged) on the current branch.

Requirements:
1. Inspect branch and status:
   - `git branch --show-current`
   - `git status --short`
2. Review diffs before committing:
   - `git diff`
   - `git diff --cached`
   - `git diff --stat`
3. Stage everything relevant to the current work session.
4. Write a reasonable commit message based on the actual diff content (not generic).
   - Prefer concise, descriptive, action-oriented wording.
   - If multiple areas changed, summarize the common intent.
5. Create one commit.
6. Push to the same branch currently checked out.
7. Return:
   - branch name
   - commit hash
   - commit message
   - pushed ref

Constraints:
- Never use `git add .`.
- Use `git add -A` or explicit pathspecs instead.
- Do not switch branches.
- Do not amend existing commits.
- Do not discard or revert local changes.
- If there are no changes to commit, report that and skip push.
