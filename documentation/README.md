# Documentation Index

This folder is the organized, source-of-truth documentation for the personalized daily newsletter system.

## Structure

- `architecture/`: system-level explanations and end-to-end flows
- `files/`: file-by-file reference docs for core app modules, routes, and jobs
- `appendix/`: glossary, setup playbooks, and reference material

## Start Here

- `vision.md`: product goals, scope boundaries, and editorial policy
- `architecture.md`: stack decisions, data model, system flows, and API contracts

## Suggested Reading Order

1. `vision.md`
2. `architecture.md`
3. `architecture/overview.md` (when added)
4. `architecture/agent-pipeline.md` (when added)
5. `architecture/api-contracts.md` (when added)
6. `appendix/glossary.md` (when added)

## Conventions

- Prefer concrete request/response payload examples where relevant.
- Mention schema/contract keys when behavior is contract-driven.
- Note assumptions explicitly (for example: cron cadence, idempotency keys, provider limits).
- Keep docs implementation-aligned: update docs when code behavior changes.
