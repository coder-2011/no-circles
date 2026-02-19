# Product Strategy: Serendipitous Encounters

## Core Positioning
- Build high-quality software for small things.
- Win through quality and simplicity in a market full of low-quality "slop."
- Do not lean on buzzwords; if the software is good, people will love it.
- No "AI powered" framing in user-facing messaging.

## Product Experience Principles
- Dead-simple interface and flow.
- Fast time-to-value.
- Clear, honest pricing communication.
- Consistent premium feel in content quality and reliability.

## Interface Direction (Dead Simple)
- Minimal landing page with 1-3 clear actions, sample output, and the number `20`.
- Primary CTA flow: user clicks `Get Started` and enters card details immediately.
- No cluttered payment handoff experience and no visible Stripe/PayPal branding.
- No immediate charge on entry; move users into the content as fast as possible.

## Payment and Trust Model
- Transparent pricing direction: `total API costs + $1`.
- The extra `$1` is explicit developer/project support.
- Keep the pricing math visible and understandable at all times.
- Include a simple pie-chart breakdown in billing updates/emails.
- If API costs change, user price may change; the profit target remains constant at `$1`.
- Goal: keep prices fair/low while preserving trust through visible math.

## Early Lifecycle and Conversion Model
- Days 1-7: deliver daily high-quality content with no payment pressure language.
- Week 1 heads-up message should be plain and human, e.g.:
- "In about a week, we would have to try to make you pay so that we can continue supporting the project."
- Week 2: process first payment after repeated value delivery and prior pricing transparency.
- Do not frame this as a "free trial"; frame it as value-first usage with transparent support costs.

## No-Buzzword Policy
- Do not market with "AI powered" claims.
- Keep messaging focused on outcomes: quality, relevance, consistency.
- Do not route users through external-looking payment links in normal flow.
- Keep experience feeling native, small, and premium.

## Serendipity as Product Magic
- Serendipity is intentional, not random.
- Beyond explicit interests, include a controlled slice of "near-edge" topics: not too tangential, but not obvious.
- Goal: create moments of useful surprise that increase retention and perceived intelligence of the product.
- Guardrails:
- maintain source credibility and no-slop standards
- preserve a majority of issue content for core user interests
- keep serendipity picks explainable relative to user profile
- make each issue feel a little magical without feeling noisy

## Personalization Depth (Future)
- Add a deeper "know the user" layer over time:
- stronger preference understanding from replies and behavior
- explicit user-editable controls
- reversibility when the model overfits
- Add Wispr Flow API to reduce friction in onboarding brain-dump collection.

## Growth Loop (Future)
- Referral-based extension flow:
- user submits 10 legitimate referral emails
- extend contract by 2 days without immediate payment-portal interaction
- Add abuse prevention for referral input quality and duplication.

## Content Quality Roadmap
- Improve Tavily subsystem quality and source management.
- Tune retrieval parameters, ranking thresholds, and filtering policies.
- Iterate prompts across onboarding memory, reply merge, and summary writing.
- Strengthen anti-repeat and diversity behavior:
- avoid sending the same links repeatedly
- increase novelty and information diversity per user over time

## Contextual Curiosity Loop (Retention Strategy)
- Product principle: the system should feel "curious with context," not repetitive and not generic.
- Each issue should progress user understanding instead of re-serving intros the user likely already knows.
- Daily discovery mix target:
- `70%` core-depth picks (deeper practical coverage in active interests)
- `20%` adjacent picks (nearby domains that improve core judgment)
- `10%` controlled serendipity picks (edge-but-relevant surprises)
- This requires two memory layers:
- anti-repeat memory (`sent_url_bloom_bits`) to block likely repeats
- recoverable recent-learning memory (small explicit recent URL/topic/domain history) to drive "next-layer" query construction
- Query quality rule: prefer specific progression prompts (advanced implementation tradeoffs, case studies, failures, migration lessons) and suppress generic/beginner listicles by default.
- Outcome goal: users feel each day's issue is smarter than yesterday's for their specific interests.

## Scale and Production Readiness
- Current one-user-per-cron model must evolve for 1000+ users/day.
- Add scalable scheduling/execution design (batching/queues/concurrency controls).
- Complete production delivery setup (custom domain + Resend + environment hardening).
- Expand full-system end-to-end and failure-path testing for production confidence.

## Success Summary
- Keep pricing transparent and profit fixed at `$1`.
- Be the high-quality option for "small things" larger companies ignore.
- Maintain trust by showing the math and consistently shipping premium content quality.

## Operating Note
- This document captures product strategy intent and direction.
- Implementation details, sequencing, and release constraints should be tracked in `documentation/todo.md` and subsystem docs.
