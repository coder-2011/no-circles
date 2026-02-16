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
- `subsystems/inbound-reply-memory-update.md`: PR3 memory processing + inbound webhook idempotency contract
- `subsystems/scheduler-and-cron.md`: Supabase scheduler ownership and cron trigger contract

## Suggested Reading Order

1. `vision.md`
2. `architecture.md`
3. `subsystems/db-and-onboarding.md`
4. `subsystems/inbound-reply-memory-update.md`
5. `files/app-api-onboarding-route.md`
6. `files/app-api-webhooks-resend-inbound-route.md`
7. `files/lib-db-schema.md`
8. `appendix/glossary.md`

## Current Subsystem Docs

- `subsystems/db-and-onboarding.md`
- `subsystems/inbound-reply-memory-update.md`
- `subsystems/exa-discovery.md`
- `subsystems/scheduler-and-cron.md`

## Current File Docs

- `files/app-api-cron-generate-next-route.md`
- `files/app-api-onboarding-route.md`
- `files/app-auth-callback-route.md`
- `files/app-globals-css.md`
- `files/app-layout.md`
- `files/app-onboarding-page.md`
- `files/app-page.md`
- `files/components-json.md`
- `files/lib-db-client.md`
- `files/lib-db-schema.md`
- `files/lib-auth-server-user.md`
- `files/lib-auth-browser-client.md`
- `files/lib-schemas.md`
- `files/lib-utils.md`
- `files/next-config.md`
- `files/drizzle-config.md`
- `files/db-migrations.md`
- `files/db-migration-0001-sturdy-ion.md`
- `files/db-migration-0002-mellow-orchid.md`
- `files/db-migration-0003-misty-calm.md`
- `files/db-migration-0004-steady-spark.md`
- `files/db-migration-meta-0001-snapshot.md`
- `files/db-migration-meta-0002-snapshot.md`
- `files/db-migration-meta-journal.md`
- `files/eslint-config.md`
- `files/postcss-config.md`
- `files/tailwind-config.md`
- `files/tests-onboarding.md`
- `files/tests-onboarding-route.md`
- `files/tests-inbound-webhook-route.md`
- `files/tests-cron-generate-next-route.md`
- `files/tests-cron-selector-db-integration.md`
- `files/tests-memory-processors-core.md`
- `files/tests-memory-processors-reply-merge.md`
- `files/tsconfig.md`
- `files/vitest-config.md`
- `files/app-api-webhooks-resend-inbound-route.md`
- `files/lib-memory-contract.md`
- `files/lib-memory-processors.md`
- `files/lib-webhooks-resend-signature.md`
- `files/lib-webhooks-inbound-idempotency.md`
- `files/lib-ai-memory-prompts.md`
- `files/lib-discovery-types.md`
- `files/lib-discovery-topic-derivation.md`
- `files/lib-discovery-exa-client.md`
- `files/lib-discovery-run-discovery.md`
- `files/scripts-prune-inbound-idempotency.md`
- `files/scripts-setup-supabase-cron.md`
- `files/next-env.md`
- `files/tests-discovery-topic-derivation.md`
- `files/tests-discovery-run.md`
- `files/tests-discovery-manual-eval-integration.md`
- `files/tests-discovery-live-exa-integration.md`

## Conventions

- Prefer concrete request/response payload examples where relevant.
- Mention schema/contract keys when behavior is contract-driven.
- Note assumptions explicitly (for example: cron cadence, idempotency keys, provider limits).
- Keep docs implementation-aligned: update docs when code behavior changes.
