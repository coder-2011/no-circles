# TODO

Root task tracker for this repository.

Rules:
- pending tasks use `- [ ]`
- completed tasks use `- [x]`
- use headings only when they help; prefer repo-relevant headings
- if a task is mentioned in chat, update this file in the same turn

## GTM
- [ ] Define the immediate GTM plan for no-circles, including channel priorities, messaging, and launch sequencing.
- [ ] Set up and execute the Twitter/X GTM workstream for no-circles.
- [ ] Design, produce, and distribute physical bookmarks as a GTM experiment.
- [x] One-shot a human-in-the-loop outreach drafting system that researches creative leads, personalizes a constrained template, and creates Gmail drafts.
- [x] Relax outreach draft generation from rigid slot-filling to safer semi-freeform personalization while preserving core No-Circles message points.
- [x] Switch outreach generation transport from Gmail draft API to SMTP with app-password auth and update docs/contracts.
- [x] Make outreach agent directly CLI-interactable with one-off `--name` mode and bulk `.txt` names mode.
- [x] Add numbered per-person `.txt` email outputs under a reports run subfolder for outbound review.
- [x] Tune outreach drafting prompt to reduce AI-sounding prose and increase subject-line creativity.

## Product
- [x] Widen the newsletter email layout on phones without changing the desktop presentation or touching the cron pipeline.
- [x] Create a screenshot-inspired lilac-parchment newsletter theme preview in `reports/` for review before production theme integration.
- [x] Evaluate Qwen 3.5 family models against the current OpenRouter recommendation using repo-shaped tasks and publish the result.
- [x] Lower the default newsletter summary target to 75 words to reduce density without abruptly changing the product feel.
- [x] Rewrite newsletter title rules so confusing source headlines can be recast for immediate clarity.
- [x] Update onboarding brain-dump guidance to invite job and broader life context, not just topic requests.
- [x] Build the core personalized newsletter pipeline from onboarding through delivery and reply-driven memory updates.
- [x] Write a canonical pricing and unit-economics spec for the live pipeline, including per-user monthly cost drivers and reflection-model upgrade costs.
- [x] Draft a global top-right sharp-corner decorative chrome motif so the visual direction can be reviewed against the logo/system style.
- [x] Expand the approved geometric line motif into a full-site background treatment while keeping the lines thin and low-contrast.
- [x] Scale the approved full-site geometric background composition up substantially so the artwork reads larger and more architectural.
- [x] Replace the prior geometric background with a stepped contour-line field based directly on the newer approved reference image.
- [x] Redistribute the background into sparse stepped line runs across the whole viewport, removing dense boxes and clustered collections.
- [x] Rework the background into a smaller set of long connected stepped paths so the linework feels continuous across the full page.
- [x] Remove stray background segments and force the linework behind all page content so it never overlaps readable text.
- [x] Remove the decorative site-wide line background completely.
- [ ] Add a newsletter preview before onboarding save so users can inspect a sample issue before committing preferences.
- [ ] Add one-click feedback chips beyond the current controls to speed up preference updates from the email surface.
- [ ] Add source-quality preference controls so users can steer toward research-heavy or blog/newsletter-heavy mixes.
- [ ] Add onboarding starter templates to reduce blank-state friction and improve first-run personalization quality.
- [ ] Add digest intensity controls so users can choose lighter or denser daily issues.
- [ ] Improve the contextual curiosity discovery loop so adjacent-topic recommendations feel less generic and more individually tailored.
- [ ] Add a delivery-status panel that explains `last_sent_at`, `next_scheduled_send`, and timezone/send-time interpretation clearly.
- [ ] Update the user-facing onboarding pricing copy to match the canonical pricing spec once the desired search/reflection configuration is chosen.

## Ops
- [x] Fix live model routing so OpenRouter auth failure can fall back cleanly to Anthropic for shared text-model calls.
- [x] Research reliable paywalled-site detection signals and design a script to filter them from discovery results.
- [x] Implement layered paywall filtering in discovery using a vendored BPC domain corpus plus page-level heuristics.
- [x] Set RLS policies for the new table.
- [x] Publish a clean comparison doc for the latest reply-evolution live run versus the closest previous live run, with fallback context from the nearest successful prior run.
- [x] Align `.env.local` OpenRouter model routing to the approved non-Qwen-3.5 production map.
- [x] Validate the OpenRouter Qwen migration against the full hyper Vitest configuration and fix any regressions in live model routing or hyper test assumptions.
- [x] Migrate the text-model stack to the approved OpenRouter Qwen routing plan, replacing the Anthropic-specific LLM call layer while keeping Perplexity/Exa and the rest of the stack scoped separately.
- [x] Run a temporary Exa-vs-Sonar discovery evaluation with prompt/query variants and publish a clean comparison report for manual quality review.
- [x] Replace the stale branch-by-branch roadmap with a single markdown task system in root `TODO.md`.
- [x] Remove the inbound webhook fallback that queried sent-email lookup for received-email IDs and caused repeat `404 Email not found` failures.
- [x] Reclaim stale outbound send idempotency rows after a timeout so abandoned `processing` locks do not spam cron forever.
- [x] Ignore obvious automated `noreply` inbound mail before content fetch so operational inbox notices do not trigger webhook noise.
- [ ] Review the active backlog periodically and prune duplicated or obsolete tasks from `TODO.md`.
- [ ] Investigate database records for newsletter emails showing an unexpected March 3 issue date and identify whether the source is scheduling, rendering, or timezone interpretation.
