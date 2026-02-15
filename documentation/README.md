# Documentation Index

This folder is the organized, source-of-truth documentation for the personalized daily newsletter system.

## Structure

- `subsystems/`: subsystem-level implementation notes and contracts
- `files/`: file-by-file reference docs for core app modules, routes, and jobs
- `appendix/`: glossary, setup playbooks, and reference material

## Start Here

- `vision.md`: product goals, scope boundaries, and editorial policy
- `architecture.md`: stack decisions, data model, system flows, and API contracts
- `subsystems/db-and-onboarding.md`: current DB + onboarding implementation status

## Suggested Reading Order

1. `vision.md`
2. `architecture.md`
3. `subsystems/db-and-onboarding.md`
4. `files/app-api-onboarding-route.md`
5. `files/lib-db-schema.md`
6. `appendix/glossary.md`

## Current File Docs

- `files/app-api-onboarding-route.md`
- `files/lib-db-client.md`
- `files/lib-db-schema.md`
- `files/lib-auth-server-user.md`
- `files/lib-schemas.md`
- `files/drizzle-config.md`
- `files/db-migrations.md`
- `files/tests-onboarding.md`
- `files/vitest-config.md`

## Conventions

- Prefer concrete request/response payload examples where relevant.
- Mention schema/contract keys when behavior is contract-driven.
- Note assumptions explicitly (for example: cron cadence, idempotency keys, provider limits).
- Keep docs implementation-aligned: update docs when code behavior changes.
