# Documentation Index

This folder is the organized, source-of-truth documentation for the personalized daily newsletter system.

## Structure

- `subsystems/`: subsystem-level implementation notes and contracts
- `files/`: file-by-file reference docs for core app modules, routes, and jobs
- `appendix/`: glossary, setup playbooks, and reference material
- `ideas.md`: product and system improvement backlog for future iterations

## Start Here

- `vision.md`: product goals, scope boundaries, and editorial policy
- `architecture.md`: stack decisions, data model, system flows, and API contracts
- `appendix/pricing-and-unit-economics.md`: canonical per-user monthly cost model, pricing assumptions, and optimization strategy
- `subsystems/db-and-onboarding.md`: current DB + onboarding implementation status
- `subsystems/inbound-reply-memory-update.md`: PR3 memory processing + inbound webhook idempotency contract
- `subsystems/scheduler-and-cron.md`: Supabase scheduler ownership and cron trigger contract
- `subsystems/summary-generation.md`: PR8 item-level summary generation contract
- `subsystems/send-and-bloom-delivery.md`: PR9 delivery runtime with Bloom + outbound idempotency
- `subsystems/personalized-quote-selection.md`: quote selection flow (HF batch pull + Haiku pick)

## Suggested Reading Order

1. `vision.md`
2. `architecture.md`
3. `appendix/pricing-and-unit-economics.md`
4. `subsystems/db-and-onboarding.md`
5. `subsystems/inbound-reply-memory-update.md`
6. `files/app-api-onboarding-route.md`
7. `files/app-api-webhooks-resend-inbound-route.md`
8. `files/lib-db-schema.md`
9. `appendix/glossary.md`

## Current Subsystem Docs

- `subsystems/db-and-onboarding.md`
- `subsystems/inbound-reply-memory-update.md`
- `subsystems/exa-discovery.md`
- `subsystems/scheduler-and-cron.md`
- `subsystems/summary-generation.md`
- `subsystems/send-and-bloom-delivery.md`
- `subsystems/personalized-quote-selection.md`
- `subsystems/ops-hardening-v1.md`
- `subsystems/caring-reflection-memory.md`

## Current File Docs

- `files/app-api-cron-generate-next-route.md`
- `files/app-api-cron-admin-monitor-route.md`
- `files/app-api-sample-brief-route.md`
- `files/app-api-deepgram-token-route.md`
- `files/app-art-page.md`
- `files/app-home-page-css.md`
- `files/app-home-page-nav.md`
- `files/app-how-it-works-page.md`
- `files/app-api-onboarding-route.md`
- `files/app-auth-callback-route.md`
- `files/proxy.md`
- `files/app-globals-css.md`
- `files/app-layout.md`
- `files/app-not-found.md`
- `files/app-onboarding-page.md`
- `files/app-onboarding-onboarding-config.md`
- `files/app-onboarding-quick-sparks-deck.md`
- `files/app-onboarding-use-onboarding-controller.md`
- `files/app-onboarding-onboarding-form.md`
- `files/app-onboarding-deepgram-dictation.md`
- `files/app-page.md`
- `files/app-home-page-content.md`
- `files/components-json.md`
- `files/components-site-cursor.md`
- `files/components-dwitter-canvas.md`
- `files/lib-db-client.md`
- `files/lib-db-schema.md`
- `files/lib-auth-server-user.md`
- `files/lib-auth-browser-client.md`
- `files/lib-auth-proxy.md`
- `files/lib-schemas.md`
- `files/lib-utils.md`
- `files/lib-sample-brief-parse-newsletter-text.md`
- `files/lib-observability-log.md`
- `files/lib-admin-alerts.md`
- `files/lib-admin-provider-monitoring.md`
- `files/next-config.md`
- `files/drizzle-config.md`
- `files/vitest-hyper-config.md`
- `files/db-migrations.md`
- `files/db-migration-0001-sturdy-ion.md`
- `files/db-migration-0002-mellow-orchid.md`
- `files/db-migration-0003-misty-calm.md`
- `files/db-migration-0004-steady-spark.md`
- `files/db-migration-0005-quiet-harbor.md`
- `files/db-migration-0006-gentle-summit.md`
- `files/db-migration-0007-calm-guardrail.md`
- `files/db-migration-0013-vivid-safeguard.md`
- `files/db-migration-0014-amber-preflight.md`
- `files/db-migration-0015-sure-policy.md`
- `files/db-migration-0016-firm-scope.md`
- `files/db-migration-0017-clean-variant.md`
- `files/db-migration-0018-brisk-recall.md`
- `files/db-migration-0019-solid-initplan.md`
- `files/db-migration-0020-alert-signal.md`
- `files/db-migration-meta-0001-snapshot.md`
- `files/db-migration-meta-0002-snapshot.md`
- `files/db-migration-meta-journal.md`
- `files/eslint-config.md`
- `files/postcss-config.md`
- `files/tailwind-config.md`
- `files/tests-onboarding.md`
- `files/tests-onboarding-route.md`
- `files/tests-sample-brief-parse-newsletter-text.md`
- `files/tests-auth-callback-route.md`
- `files/tests-onboarding-deepgram-dictation.md`
- `files/tests-deepgram-token-route.md`
- `files/tests-inbound-webhook-route.md`
- `files/tests-cron-generate-next-route.md`
- `files/tests-cron-selector-db-integration.md`
- `files/tests-memory-processors-core.md`
- `files/tests-memory-processors-reply-merge.md`
- `files/tsconfig.md`
- `files/vitest-config.md`
- `files/app-api-webhooks-resend-inbound-route.md`
- `files/lib-memory-contract.md`
- `files/lib-memory-active-interest-lanes.md`
- `files/lib-memory-processors.md`
- `files/lib-memory-email-history.md`
- `files/lib-memory-model-client.md`
- `files/lib-memory-reflection.md`
- `files/lib-webhooks-resend-signature.md`
- `files/lib-webhooks-inbound-idempotency.md`
- `files/lib-ai-memory-prompts.md`
- `files/lib-ai-summary-prompts.md`
- `files/lib-ai-quote-prompts.md`
- `files/lib-art-dwitter-sketches.md`
- `files/lib-bloom-user-url-bloom.md`
- `files/lib-discovery-types.md`
- `files/lib-discovery-topic-derivation.md`
- `files/lib-discovery-exa-client.md`
- `files/lib-discovery-exa-contents.md`
- `files/lib-discovery-url-excerpt.md`
- `files/lib-discovery-sonar-client.md`
- `files/lib-discovery-search-blocklists.md`
- `files/lib-discovery-haiku-link-selector.md`
- `files/lib-discovery-haiku-serendipity-selector.md`
- `files/lib-discovery-haiku-query-builder.md`
- `files/lib-discovery-run-discovery-candidate-utils.md`
- `files/lib-discovery-run-discovery-planning.md`
- `files/lib-discovery-run-discovery.md`
- `files/lib-summary-writer.md`
- `files/lib-email-render-newsletter.md`
- `files/lib-email-send-newsletter.md`
- `files/lib-send-idempotency.md`
- `files/lib-pipeline-send-user-newsletter.md`
- `files/lib-quotes-select-personalized-quote.md`
- `files/scripts-prune-inbound-idempotency.md`
- `files/scripts-setup-supabase-cron.md`
- `files/public-onboarding-quick-sparks-txt.md`
- `files/next-env.md`
- `files/tests-discovery-topic-derivation.md`
- `files/tests-discovery-run.md`
- `files/tests-discovery-sonar-client.md`
- `files/tests-discovery-haiku-link-selector.md`
- `files/tests-discovery-manual-eval-integration.md`
- `files/tests-discovery-live-exa-integration.md`
- `files/tests-summary-writer.md`
- `files/tests-ai-memory-prompts.md`
- `files/tests-ai-quote-prompts.md`
- `files/tests-quote-selection.md`
- `files/tests-bloom-user-url-bloom.md`
- `files/tests-email-render-newsletter.md`
- `files/tests-email-send-newsletter.md`
- `files/tests-send-idempotency.md`
- `files/tests-send-user-newsletter.md`
- `files/tests-hyper-logging.md`
- `files/tests-hyper-pipeline-seam-integration.md`
- `files/tests-hyper-full-system-live-integration.md`
- `files/tests-hyper-reply-evolution-live-integration.md`
- `files/tests-hyper-reflection-live-integration.md`
- `files/tests-hyper-reflection-seeded-history-live-integration.md`
- `files/tests-hyper-query-system-live-integration.md`
- `files/tests-hyper-serendipity-live-integration.md`
- `files/lib-feedback-click-token.md`
- `files/lib-feedback-newsletter-links.md`
- `files/app-api-feedback-click-route.md`
- `files/tests-feedback-click-token.md`
- `files/tests-feedback-click-route.md`
- `files/tests-hyper-quote-selection-live-integration.md`

## Conventions

- Prefer concrete request/response payload examples where relevant.
- Mention schema/contract keys when behavior is contract-driven.
- Note assumptions explicitly (for example: cron cadence, idempotency keys, provider limits).
- Keep docs implementation-aligned: update docs when code behavior changes.
