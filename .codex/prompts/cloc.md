# cloc

Count authored lines of code with `cloc`, broken down by language, while excluding generated, vendored, and non-authored paths.

## Goal
- report total LOC and language breakdown for code the repo owner is likely to have written
- exclude build outputs, docs, logs, lockfiles, migration metadata snapshots, generated files, and common vendored UI code

## Run
```bash
cloc . \
  --vcs=git \
  --include-dir=app,components,lib,db,tests,scripts \
  --fullpath \
  --not-match-d='(^|/)(node_modules|\.next|coverage|dist|build|out|\.vercel|\.turbo|logs|documentation|public|\.codex|\.git|\.task|db/migrations/meta)($|/)' \
  --not-match-f='(^|/)(.*\.d\.ts|.*\.generated\..*|.*\.gen\..*|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|components/ui/.*)$'
```

## Output Contract
- return the `cloc` totals and language table
- call out any assumptions if a path was excluded because it looks generated or vendored
- if `cloc` is unavailable, say so plainly instead of silently falling back to another tool

## Notes
- this intentionally counts tracked authored source areas only: `app`, `components`, `lib`, `db`, `tests`, `scripts`
- `db/migrations/*.sql` stays included because those are authored schema changes
- `db/migrations/meta` stays excluded because it is generated migration bookkeeping
