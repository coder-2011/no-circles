# Pricing And Unit Economics

## Purpose
- This is the canonical pricing model for No Circles.
- All estimates here are per user per month.
- This document prices the system from the live codebase, not from older architecture assumptions.

## Scope
- Included: Anthropic, Perplexity, Exa, Resend, Deepgram.
- Included: onboarding, welcome issue, steady-state daily issues, reply-driven memory updates, reflection.
- Excluded from the main monthly variable-cost table: fixed platform subscriptions such as Supabase and Vercel, because their public pricing is mostly plan-based rather than meaningfully per-request at current scale.
- If you want fully loaded cost later, add a separate fixed-overhead term: `(monthly fixed infra spend / active monthly users)`.

## Ground Truth From The Live Code

### Facts
- Daily send path is `sendUserNewsletter(...)` in `lib/pipeline/send-user-newsletter.ts`.
- Discovery is Sonar-first, not Exa-search-first:
  - one Anthropic query-builder call per topic
  - one Perplexity Sonar search call per topic
  - one Anthropic link-selector call per topic only when more than one viable candidate remains
- Exa is used after selection to fetch final highlights for the chosen URLs.
- Summary generation is one Anthropic call per selected item.
- Quote selection is one Hugging Face dataset fetch plus one Anthropic call per issue.
- Reflection is gated to daily issues only and only when the last reflection is at least two local days old.
- Onboarding triggers:
  - one onboarding-memory Anthropic call
  - one transactional intro email
  - one welcome issue with `targetItemCount = 5`
- Reply updates trigger:
  - one inbound Resend fetch path
  - one Anthropic reply-memory update call

### Current Environment Reality
- `.env.local` currently sets only `ANTHROPIC_MEMORY_MODEL="claude-haiku-4-5"`.
- No separate summary/query/link/quote/reflection overrides are currently set locally.
- In practice, that means most Anthropic tasks currently fall back to Haiku 4.5 unless deployment env differs.
- Perplexity search context defaults to `medium` in `lib/discovery/sonar-client.ts`.

## Official Vendor Pricing Used
- Anthropic
  - Haiku 4.5: $1 / MTok input, $5 / MTok output
  - Sonnet 4.6: $3 / MTok input, $15 / MTok output
  - Opus 4.6: $5 / MTok input, $25 / MTok output
  - Sources:
    - https://www.anthropic.com/claude/haiku
    - https://www.anthropic.com/claude/sonnet
    - https://www.anthropic.com/claude/opus
- Perplexity Sonar API
  - token pricing: $1 / MTok input, $1 / MTok output
  - request fee by search context size:
    - low: $5 / 1k requests
    - medium: $8 / 1k requests
    - high: $12 / 1k requests
  - source: https://docs.perplexity.ai/guides/pricing
- Exa
  - search: $5 / 1k requests
  - contents/highlights: $1 / 1k pages
  - source: https://exa.ai/pricing
- Resend
  - overage: $0.90 / 1k emails
  - source: https://resend.com/pricing
- Deepgram
  - Nova-3 STT: $0.0043 / minute
  - source: https://deepgram.com/pricing

## Capability Positioning Used For Model Strategy
- Anthropic positions Haiku 4.5 as the fast, low-cost model and says it matches Claude Sonnet 4 on core coding, computer use, and agentic tasks.
- Anthropic positions Sonnet 4.6 as stronger on coding and more reliable on complex agentic work.
- Anthropic positions Opus 4.6 as the most capable model for frontier intelligence and demanding reasoning.
- Source pages:
  - https://www.anthropic.com/claude/haiku
  - https://www.anthropic.com/claude/sonnet
  - https://www.anthropic.com/claude/opus

## Estimation Method

### Facts
- Daily issue target count defaults to `10`.
- Welcome issue target count is `5`.
- Discovery uses `maxAttempts: 1`, `perTopicResults: 7`, and `maxTopics: 10`.
- Reflection prompt can include up to:
  - current memory
  - last 5 sent emails
  - last 5 reply emails
- Summary model `max_tokens` is `350`.
- Query-builder `max_tokens` is `90`.
- Link-selector `max_tokens` is `120`.
- Serendipity-selector `max_tokens` is `140`.
- Quote selector `max_tokens` is `160`.
- Reflection `max_tokens` is `1000`.
- Memory model `max_tokens` is `1200`.

### Measured Representative Prompt Sizes
- These are approximate input-token estimates from local prompt renderings using `chars / 4` as the approximation rule.
- They are not exact Anthropic billable-token counts, but they are good enough for monthly planning.

| Call type | Approx input tokens |
| --- | ---: |
| onboarding memory | 603 |
| reply memory update | 1,484 |
| query builder | 623 |
| link selector | 1,684 |
| serendipity selector | 578 |
| summary writer | 2,122 |
| quote selector | 707 |
| reflection | 13,001 |

### Important Inferences
- Summary and reflection costs are the most sensitive to real content length.
- Sonar token cost is small relative to Sonar request fees, so the request-fee component dominates.
- Reflection thinking-mode cost should be modeled as extra output-token spend, because Anthropic prices these models on input and output tokens and thinking increases generated output.

## Monthly Scenarios

### Scenario Assumptions

#### Lean steady-state user
- 30 daily issues/month
- 6 discovery topics/issue
- link selector used on 60% of topics
- 0.5 reply updates/month
- 1 serendipity selection call/issue
- Sonar search context: `medium`

#### Base steady-state user
- 30 daily issues/month
- 8 discovery topics/issue
- link selector used on 80% of topics
- 2 reply updates/month
- 1 serendipity selection call/issue
- Sonar search context: `medium`

#### Heavy steady-state user
- 30 daily issues/month
- 10 discovery topics/issue
- link selector used on 100% of topics
- 8 reply updates/month
- 0 serendipity calls/issue because all 10 topic slots are already occupied
- Sonar search context: `medium`

## Steady-State Monthly Cost

| Cost bucket | Lean | Base | Heavy |
| --- | ---: | ---: | ---: |
| Perplexity Sonar | $1.566 | $2.088 | $2.610 |
| Anthropic summaries | $0.862 | $0.862 | $0.862 |
| Anthropic link selector | $0.193 | $0.343 | $0.535 |
| Exa final highlights | $0.300 | $0.300 | $0.300 |
| Anthropic reflection on Haiku | $0.214 | $0.214 | $0.214 |
| Anthropic query builder | $0.126 | $0.168 | $0.209 |
| Anthropic quote selector | $0.023 | $0.023 | $0.023 |
| Anthropic serendipity selector | $0.022 | $0.022 | $0.000 |
| Anthropic reply memory updates | $0.001 | $0.004 | $0.017 |
| Resend marginal send cost | $0.027 | $0.027 | $0.027 |
| Total | $3.332 | $4.049 | $4.796 |

## Biggest And Smallest Spend Buckets

### Base steady-state user
- Biggest:
  - Perplexity Sonar: `$2.088` (`51.6%` of monthly variable cost)
  - Anthropic summaries: `$0.862` (`21.3%`)
  - Anthropic link selector: `$0.343` (`8.5%`)
  - Exa final highlights: `$0.300` (`7.4%`)
- Smallest:
  - Anthropic reply memory updates: `$0.004`
  - Anthropic quote selector: `$0.023`
  - Anthropic serendipity selector: `$0.022`
  - Resend marginal send cost: `$0.027`

### Takeaway
- Search is the main cost center.
- Summaries are the second-largest cost center.
- Reflection is not the main driver while it stays on Haiku, even though it has the largest single prompt.

## First-Month New-User Add-On
- This is the extra cost on top of steady-state for a newly onboarded user.
- Assumptions:
  - one onboarding memory pass
  - one intro email
  - one welcome issue
  - 6 topic searches in the welcome issue
  - 5 welcome summaries
  - one quote selection
  - 5 Exa highlight pages
  - 5 minutes of Deepgram Nova-3 dictation

| First-month add-on | Medium Sonar | Low Sonar |
| --- | ---: | ---: |
| Incremental new-user cost | $0.111 | $0.093 |

### Takeaway
- Onboarding and welcome are cheap.
- The recurring monthly economics are dominated by daily discovery and summary generation, not by signup.

## Reflection Upgrade Cost

### Reflection-Only Monthly Cost At 15 Runs/User-Month
- Input assumption: `13,001` tokens/run
- Output assumption varies by answer + thinking budget

| Reflection model | 250 output tokens/run | 1,000 output tokens/run | 2,000 output tokens/run | 4,000 output tokens/run |
| --- | ---: | ---: | ---: | ---: |
| Haiku 4.5 | $0.214 | $0.270 | $0.345 | $0.495 |
| Sonnet 4.6 | $0.641 | $0.810 | $1.035 | $1.485 |
| Opus 4.6 | $1.069 | $1.350 | $1.725 | $2.475 |

### Total Base-Month Cost If Reflection Is Upgraded

| Base monthly config | Sonar medium | Sonar low |
| --- | ---: | ---: |
| current Haiku reflection, 250 output | $4.049 | $3.329 |
| Sonnet reflection, 250 output | $4.476 | $3.756 |
| Sonnet reflection, 1,000 output | $4.645 | $3.925 |
| Sonnet reflection, 2,000 output | $4.870 | $4.150 |
| Opus reflection, 250 output | $4.904 | $4.184 |
| Opus reflection, 2,000 output | $5.560 | $4.840 |

### Reflection Recommendation
- If you want a stronger “thinking” reflection pass while staying under `$5`, the cleanest path is:
  - switch Sonar from `medium` to `low`
  - use Sonnet 4.6 for reflection only
  - keep reflection output budget around `1,000-2,000` total tokens/run
- That keeps the modeled base user around `$3.93-$4.15/user/month`.

## Cost-Reduction Strategy

### 1. Switch Sonar search context from `medium` to `low`
- Base user drops from `$4.049` to `$3.329`.
- Savings: about `$0.72/user/month`.
- Why this is the best first lever:
  - Sonar request fees are the largest cost bucket.
  - This change does not alter your model stack or prompt contracts.
- Risk:
  - retrieval quality may drop on harder or more obscure queries.
- Recommendation:
  - make this your first cost experiment.

### 2. Reduce average searched topics from 8 to 6
- Base-low-context user drops from `$3.329` to about `$2.860`.
- Savings: about `$0.47/user/month`.
- Why it can work:
  - the issue only needs 10 final items, not exhaustive topic coverage every day.
  - many users do not need 8-10 distinct topic lanes every single issue.
- Risk:
  - less breadth and less chance of good serendipity.
- Recommendation:
  - reduce topic count only after low-context Sonar is tested.

### 3. Reduce Exa highlight payload size
- Current summary prompt estimate is about `2,122` input tokens/item.
- If you push the effective summary input closer to `1,500` tokens/item, the modeled base-low user drops from `$3.329` to about `$3.143`.
- Savings: about `$0.19/user/month`.
- Why it can work:
  - summary quality usually saturates before 4,500 characters of highlights.
- Risk:
  - some long-form technical pieces may lose the extra detail that makes the summary strong.
- Recommendation:
  - test a lower `EXA_FINAL_HIGHLIGHT_MAX_CHARACTERS` value before changing models.

### 4. Compress reflection context before upgrading reflection models
- Current reflection prompt estimate is about `13,001` input tokens/run because it inlines recent full-text sent emails.
- If you cut reflection input from ~13k to ~4k tokens, Haiku savings are small, but Sonnet-thinking savings are meaningful.
- Example:
  - Sonnet reflection at 2,000 output tokens/run saves about `$0.405/user/month` if you reduce input from ~13k to ~4k.
- Best way to do this:
  - store a compact reflection-facing history artifact instead of full rendered email text
  - keep titles, topics, and one-line per-item summaries rather than the complete outgoing email body

### 5. Keep narrow structured tasks on Haiku
- Best Haiku candidates:
  - onboarding memory formatting
  - reply-memory delta extraction
  - query building
  - link selection
  - quote selection
- Why:
  - these are narrow, bounded, structured tasks
  - Anthropic explicitly positions Haiku as strong on low-latency agentic work
- Recommendation:
  - do not move these to Sonnet unless quality evals show a real failure mode.

## Where Model Downsizing Is Actually Safe

### Safe to keep cheap
- onboarding memory
- reply memory updates
- query builder
- link selector
- quote selector

### Usually safe to keep cheap, but monitor quality
- summary writer
- Why:
  - it is more interpretive than the selector tasks, so it is the first place Haiku quality can feel “thin”
- Recommendation:
  - keep summaries on Haiku unless editorial evals show persistent abstraction or clarity failures

### Best candidate for an expensive model
- reflection
- Why:
  - reflection is the only path that combines long context, longitudinal reasoning, and durable user-model correction
  - if you spend Sonnet or thinking budget anywhere, this is the highest-leverage place

## Recommended Pricing Strategy

### If the goal is “stay comfortably under $5”
- Recommended operating config:
  - keep all current Anthropic paths on Haiku 4.5
  - switch Sonar from `medium` to `low`
  - keep current reflection cadence
- Modeled base user: about `$3.33/user/month`
- This leaves room for either a small markup or a fixed-overhead allocation while still staying near the original low-price intent.

### If the goal is “upgrade reflection quality without crossing $5”
- Recommended operating config:
  - Sonar `low`
  - Sonnet 4.6 reflection only
  - output budget around `1,000-2,000` total tokens/run
  - everything else remains on Haiku
- Modeled base user: about `$3.93-$4.15/user/month`

### If the goal is “highest reflection quality regardless of margin”
- Opus reflection is viable.
- But Opus with material thinking budget becomes the easiest way to cross the `$5` target.
- Example:
  - base user with Sonar medium + Opus reflection at 2,000 output tokens/run models at about `$5.56/user/month`

## Strategic Conclusion
- The live system is already fairly efficient because most Anthropic work is effectively on Haiku.
- Your real cost center is retrieval, not memory mutation.
- The cleanest pricing path is:
  - optimize Perplexity first
  - keep most tasks on Haiku
  - spend premium-model budget only on reflection
- If you want the best “under `$5` but still feels smart” configuration, the current best candidate is:
  - Sonar `low`
  - Haiku for onboarding, replies, query building, link selection, summaries, and quotes
  - Sonnet 4.6 for reflection only
  - modest reflection thinking/output budget

## Follow-Up Docs That Need Alignment
- `documentation/appendix/product-strategy-no-circles.md`
- user-facing onboarding pricing copy in the actual app UI
- any future billing emails or landing-page pricing explanations
