set shell := ["bash", "-cu"]

# TODO.md helpers (project-scoped)
todo-show:
	sed -n '1,240p' TODO.md

todo-sync-prompts:
	cp .codex/prompts/todo-daily.md /Users/namanchetwani/.codex/prompts/todo-daily.md
	cp .codex/prompts/todo-planning.md /Users/namanchetwani/.codex/prompts/todo-planning.md
	cp .codex/prompts/todo-review.md /Users/namanchetwani/.codex/prompts/todo-review.md
	cp .codex/prompts/todo-capture.md /Users/namanchetwani/.codex/prompts/todo-capture.md

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

# Run caring reflection hyper live integration test with local env loaded
hyper-reflection-live:
	set -a; [ -f ./.env.local ] && . ./.env.local; set +a; \
	npx vitest run --config vitest.hyper.config.ts tests/hyper/reflection-live.integration.test.ts

# Run seeded-history caring reflection rewrite hyper test with local env loaded
hyper-reflection-seeded-history-live:
	set -a; [ -f ./.env.local ] && . ./.env.local; set +a; \
	npx vitest run --config vitest.hyper.config.ts tests/hyper/reflection-seeded-history-live.integration.test.ts

# Run query-system hyper live integration test with local env loaded
hyper-query-system-live:
	set -a; [ -f ./.env.local ] && . ./.env.local; set +a; \
	npx vitest run --config vitest.hyper.config.ts tests/hyper/query-system-live.integration.test.ts

# Run the deterministic multi-day caring reflection simulation seam test
reflection-simulation:
	npx vitest run tests/send-user-newsletter-reflection-simulation.test.ts

# Count tracked code LOC on default branch
# Ref preference order: origin/master -> origin/main -> master -> main
main-loc:
	ref=$(if git rev-parse --verify origin/master >/dev/null 2>&1; then echo origin/master; elif git rev-parse --verify origin/main >/dev/null 2>&1; then echo origin/main; elif git rev-parse --verify master >/dev/null 2>&1; then echo master; else echo main; fi); \
	git ls-tree -r --name-only $ref \
	| rg '\.(ts|tsx|js|jsx|mjs|cjs|css|sql)$' \
	| while read -r file; do git show "$ref:$file"; done \
	| wc -l

# Alias: count tracked code LOC using the same default-branch resolution
loc:
	ref=$(if git rev-parse --verify origin/master >/dev/null 2>&1; then echo origin/master; elif git rev-parse --verify origin/main >/dev/null 2>&1; then echo origin/main; elif git rev-parse --verify master >/dev/null 2>&1; then echo master; else echo main; fi); \
	git ls-tree -r --name-only $ref \
	| rg '\.(ts|tsx|js|jsx|mjs|cjs|css|sql)$' \
	| while read -r file; do git show "$ref:$file"; done \
	| wc -l

# Run outreach generator for one person (dry-run by default)
outreach-name name:
	set -a; [ -f ./.env.local ] && . ./.env.local; set +a; \
	node scripts/generate-outreach-drafts.mjs --name "{{name}}" --dry-run

# Run outreach generator from txt list (dry-run by default)
outreach-txt txt_path:
	set -a; [ -f ./.env.local ] && . ./.env.local; set +a; \
	node scripts/generate-outreach-drafts.mjs --txt "{{txt_path}}" --dry-run
