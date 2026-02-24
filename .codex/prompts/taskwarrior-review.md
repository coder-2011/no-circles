# Taskwarrior Release Review Prompt

Before merge/release, run a task-based readiness review.

Checklist:
1. `task project:no-circles status:pending`
2. Confirm all in-scope tasks are done or explicitly deferred.
3. For each open task, classify:
   - blocker for release
   - safe follow-up
4. Ensure test/build tasks were completed and recorded.
5. Create immediate follow-up tasks for any residual risks.

Output format:
- Done tasks
- Remaining tasks
- Release blockers (if any)
- Next 1-3 tasks
