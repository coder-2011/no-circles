# Repository Guidelines

Naman owns this.
Start: say hi + 1 motivating line.
Editor: `code <path>`.
CI: `gh run list` / `gh run view` (rerun/fix until green).
Oracle: run `npx -y @steipete/oracle --help` once/session before first use.
Work style: explain thoroughly and simply; min tokens.
PRs: use `gh pr view` / `gh pr diff` (no URLs).
New deps: quick health check (recent releases/commits, adoption).

## Project Objective
Build a website-first, personalized daily newsletter system that curates 10 high-quality links from user interests, sends by email, and updates interest memory from inbound replies.

## Stack Snapshot
- Next.js + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Postgres + Drizzle ORM + drizzle-kit
- Claude Sonnet 4.5 (writer + reply parsing)
- Exa (discovery)
- Resend (outbound + inbound)
- Vercel + Vercel Cron (every minute)
- zod, date-fns/date-fns-tz, Vitest

## Root Folder Structure
- `app/`: Next.js pages and API routes.
- `components/`: reusable UI components.
- `lib/`: shared logic, schemas, and service helpers.
- `db/`: database-related code and migration/config artifacts.
- `documentation/`: source-of-truth product and architecture docs.
- `.codex/`: memory system files, prompts, and state logs.
- `tests/`: Vitest unit/integration tests.
- `public/`: static assets.
- `scripts/`: operational helper scripts.

## Documentation Structure Policy (Required)
- Organize `documentation/` with these subfolders:
  - `documentation/subsystems/`
  - `documentation/files/`
  - `documentation/appendix/`
- For each subsystem defined in architecture/planning, create and maintain a dedicated markdown doc under `documentation/subsystems/` describing purpose, contracts, flow, and implementation notes.
- For every code file created in the project, create and maintain a corresponding markdown reference doc under `documentation/files/` explaining what the file does and why it exists.
- Keep `documentation/vision.md` and `documentation/architecture.md` as top-level source-of-truth docs, and ensure subsystem/file docs stay aligned with them.
- Use `documentation/appendix/` for key vocabulary, core concepts, and shared definitions used across the project.

## Screenshot Resolution Policy
- When a prompt references a screenshot or image without a specific filename, resolve it to the most recent timestamped file in the `images/` directory.
- Treat this as the default image-selection rule unless the user explicitly names a different file.

## Reasoning and Explanations
- Explanations: clarity + truthfulness first; no motivational framing.
- Start from known facts + explicit assumptions; build from first principles.
- Reason probabilistically under uncertainty; state confidence and alternatives.
- Separate fact vs inference vs speculation.

## Evidence-First Reasoning Mindset
- Rationality decides truth; not debate-point scoring.
- Forward flow only: evidence -> belief update -> conclusion.
- Ban backward flow: no fixed conclusion + cherry-picked support.
- Design tests that can disconfirm favored ideas, not only confirm them.

## Agentic Memory System
- Reference `.codex/LEARNINGS.md` before execution to avoid regression.
- Before starting a task, read the last 50 lines of `.codex/STATE.md`.
- If stuck/lost or missing decision context, immediately read `.codex/STATE.md`.
- Append concise entries to `.codex/LEARNINGS.md` for non-trivial bug fixes, env fixes, or architecture decisions.
- Before ending session, append a concise status update to `.codex/STATE.md`.
- Atomic logging rule (every response): `[TIMESTAMP] | ATOMIC: {Brief summary}`.
- Session handoff rule: `[TIMESTAMP] | SESSION_SUMMARY: {...} | BLOCKERS: {...} | NEXT_STEP: {...}`.
- Global enforcement: apply this memory/logging protocol to all `AGENTS.md` files in the repo.

## Memory Bootstrap Playbook
- Purpose: standardized continuity across sessions using `.codex/STATE.md`, `.codex/LEARNINGS.md`, `.codex/prompts/`, and `justfile`.
- New-repo checklist:
  - create `.codex/`
  - create `.codex/STATE.md` and `.codex/LEARNINGS.md`
  - create `.codex/prompts/primer.md`
  - add memory + logging protocol to all `AGENTS.md`
  - add or update `justfile` with memory helpers
  - write first ATOMIC log entry

## Prompt Pack Guidance
- `STATE.md` setup prompt: enforce Golden Rule, initialization read-tail-50, ATOMIC logs each response, and session wrap-up summary.
- `LEARNINGS.md` setup prompt: append non-trivial bug/env/architecture learnings and keep entries concise/scan-fast.
- Keep reusable prompts under `.codex/prompts/` (not `.codex/commands/`).
- Primer prompt path: `.codex/prompts/primer.md`.

## GitHub Workflow (Required)
- Branch-per-feature/subsystem workflow.
- Expect many short-lived branches (10-14+ is normal).
- For each branch: implement one scoped feature, do micro commits, test, then open PR.
- Do not mix unrelated subsystem work in one branch.
- Prefer naming like:
  - `feature/onboarding-flow`
  - `feature/agent-pipeline`
  - `feature/inbound-reply-webhook`
  - `feature/newsletter-delivery`

## Commit and PR Rules
- Micro commits are expected.
- Commit frequently during implementation, not only at the end.
- Mandatory commit/push threshold:
  - If a scoped change modifies more than 10 lines of code, you must commit and push that change before continuing to additional unrelated work.
  - Count threshold using git diff line changes on code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, `.sql`): additions + deletions.
  - This rule applies even when the feature is not fully complete; use small, coherent, incremental commits.
- Commit message rigor (required):
  - Before every commit, inspect `git diff --stat` and `git diff --name-status` (or equivalent) and base the commit message on the actual diff.
  - Commit messages must be specific to changed subsystem/files and user-visible or contract-level behavior.
  - Do not use vague messages (for example: `update`, `misc`, `random`, `wip`) and do not push random mixed changes without a scoped message.
- PR after feature is done and testing is done.
- PR must include: scope summary, rationale, test evidence, and screenshots for UI changes.
- Before PR: check CI status with `gh run list` / `gh run view` and get green.
- PR size guidance: once branch diff is roughly 500-800 changed lines, recommend opening a PR (or splitting work) rather than continuing to grow the branch.
- If changes exceed ~800 lines, strongly prefer splitting into multiple scoped PRs.

## Build, Test, and Development Commands
- `npm install` - install dependencies.
- `npm run dev` - run local app.
- `npm run build` - production build check.
- `npm run lint` - lint checks.
- `npm run test` - unit/integration tests (Vitest).
- Do not run `npm run test` or `npm run test:hyper` unless user explicitly grants permission in the current session.

## Coding Style and Conventions
- TypeScript-first. Strict types for API, parsing, and DB boundaries.
- Use zod schemas at external boundaries (webhooks, API inputs, model outputs).
- Naming: `camelCase` vars/functions, `PascalCase` components/classes, `kebab-case` route segments/files.
- Keep edits surgical and high-signal.
- File size policy: keep files under 500 LOC.
- If a file approaches 500 LOC, split by concern (routes/services/utils/components) before adding more logic.

## Git Safety
- Safe defaults: `git status`, `git diff`, `git log`.
- Branch switches only with user consent.
- No destructive git operations unless explicitly requested.
- `git rm` is allowed when files are intentionally removed as part of the scoped change.
- No amend unless asked.
- Never use `git add .`; use `git add -A` or explicit pathspecs.

## Just Command Policy
- Prefer existing `just` commands when available for repetitive workflows.
- If a workflow is repeated twice, add a practical `just` recipe.
- Keep recipes minimal and non-duplicative.
- After creating a new recipe, report: `CLI Shortcut Created: just {command}`.
- Keep `AGENTS.md` and `justfile` synchronized: when new recipes are added, document them in this file.
- Current shared recipes:
  - `just repo-state`
  - `just state-tail50`
  - `just state-atomic "<message>"`
  - `just state-session-summary "<done>" "<blockers>" "<next>"`
  - `just todo-show`
  - `just todo-sync-prompts`
  - `just install`
  - `just dev`
  - `just build`
  - `just lint`
  - `just test`
  - `just hyper-reply-evolution-live`
  - `just hyper-reflection-live`
  - `just hyper-reflection-seeded-history-live`
  - `just hyper-query-system-live`
  - `just reflection-simulation`
  - `just main-loc`
  - `just loc`
  - `just outreach-name "<name>"`
  - `just outreach-txt "<path-to-txt>"`

## tmux
Use only when persistence/interaction is required (debugger/server).
Quick refs: `tmux new -d -s codex-shell`, `tmux attach -t codex-shell`, `tmux list-sessions`, `tmux kill-session -t codex-shell`.

## oracle
Bundle prompt+files for a second model when stuck/buggy/review.
Run once/session before first use: `npx -y @steipete/oracle --help`.

## TODO.md Workflow (Required)
- Use root `TODO.md` as the default execution tracker for scoped implementation work.
- Treat `TODO.md` as the single live task system; do not maintain a parallel tracker.
- Represent pending tasks with `- [ ]` and completed tasks with `- [x]`.
- Group tasks only when grouping adds clarity.
- Use normal project-relevant headings such as:
  - `Product`
  - `Frontend`
  - `Backend`
  - `Infra`
  - `Ops`
- Do not force irrelevant categories onto the repo.
- When the user mentions a task in natural language, update `TODO.md` silently in the same turn.
- When a task is finished, mark it completed in `TODO.md` in the same turn as the implementing change.
- Keep tasks small, concrete, and outcome-oriented; split broad requests into the smallest safe actionable slices.
- Prompt templates for planning/triage/live updates must live in:
  - local: `.codex/prompts/`
  - global: `/Users/namanchetwani/.codex/prompts/`
- Prefer `just todo-*` shortcuts over ad hoc commands when available.

## Intent Mapping (Required)
- Treat natural-language phrasing like "I have a task...", "add a task...", "track this task...", "we need to...", or close variants as `TODO.md` intent.
- Treat natural-language phrasing like "I have an idea...", "capture this idea...", "note this idea...", or close variants as ideas backlog intent (for example `documentation/ideas.md`), unless explicitly requested as an actionable task.
- If wording is ambiguous between idea vs task, prefer:
  1. actionable/near-term phrasing -> `TODO.md` task
  2. exploratory/brainstorm phrasing -> ideas backlog entry
- If needed, store both: idea in `documentation/ideas.md` and actionable execution item in `TODO.md`.

## Engineering Quality Bar
- Keep quality bar high for every change.
- Make only intentional changes with clear value relative to risk/complexity.
- Validate behavior before PR; fix CI breaks before merge.
