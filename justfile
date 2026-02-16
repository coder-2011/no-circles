set shell := ["bash", "-cu"]

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

e2e:
	npx playwright test

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
