set shell := ["bash", "-cu"]

# Taskwarrior helpers (project-scoped)
task-next:
	task rc:.taskrc project:no-circles next

task-add description:
	task rc:.taskrc add project:no-circles "{{description}}"

task-add-pri description priority:
	task rc:.taskrc add project:no-circles priority:{{priority}} "{{description}}"

task-done id:
	task rc:.taskrc {{id}} done

task-work:
	task rc:.taskrc project:no-circles all

task-ready:
	task rc:.taskrc project:no-circles status:pending or status:waiting

task-overdue:
	task rc:.taskrc project:no-circles overdue

task-sync-prompts:
	cp .codex/prompts/taskwarrior-daily.md /Users/namanchetwani/.codex/prompts/taskwarrior-daily.md
	cp .codex/prompts/taskwarrior-planning.md /Users/namanchetwani/.codex/prompts/taskwarrior-planning.md
	cp .codex/prompts/taskwarrior-review.md /Users/namanchetwani/.codex/prompts/taskwarrior-review.md

# Show git status + branch quickly
repo-state:
	git branch --show-current
	git status --short

# Show last 50 lines of state log
state-tail50:
	tail -n 50 .codex/STATE.md

# Append one atomic state log entry
state-atomic message:
	echo "[$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")] | ATOMIC: {{message}}" >> .codex/STATE.md

# Append one session summary entry
state-session-summary done blockers next:
	echo "[$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")] | SESSION_SUMMARY: {{done}} | BLOCKERS: {{blockers}} | NEXT_STEP: {{next}}" >> .codex/STATE.md

# Local app/dev helpers
install:
	npm install

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

test:
	npm run test

# Run reply-evolution hyper live integration test with local env loaded
hyper-reply-evolution-live:
	set -a; [ -f ./.env.local ] && . ./.env.local; set +a; \
	npx vitest run --config vitest.hyper.config.ts tests/hyper/reply-evolution-live.integration.test.ts

# Run query-system hyper live integration test with local env loaded
hyper-query-system-live:
	set -a; [ -f ./.env.local ] && . ./.env.local; set +a; \
	npx vitest run --config vitest.hyper.config.ts tests/hyper/query-system-live.integration.test.ts

# Count tracked code LOC on main branch (prefers origin/main when available)
main-loc:
	ref=$$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo origin/main || echo main); \
	git ls-tree -r --name-only $$ref \
	| rg '\.(ts|tsx|js|jsx|mjs|cjs|css|sql)$$' \
	| while read -r file; do git show "$$ref:$$file"; done \
	| wc -l

# Alias: count tracked code LOC on main branch (prefers origin/main when available)
loc:
	ref=$$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo origin/main || echo main); \
	git ls-tree -r --name-only $$ref \
	| rg '\.(ts|tsx|js|jsx|mjs|cjs|css|sql)$$' \
	| while read -r file; do git show "$$ref:$$file"; done \
	| wc -l
