# Ideas Backlog: Curiosity-Predictor Product Direction

## Purpose
Capture high-leverage product ideas that can meaningfully improve content quality, retention, and personalization depth beyond incremental prompt patches.

## Core Direction
- Reframe discovery as a curiosity-prediction problem, not only a retrieval problem.
- Goal: build a lightweight digital twin of a user's "curious self" and use it to decide what they should read next.

## Priority Idea 1: Contextual Curiosity Topic Lanes
- Use explicit topic lanes for each issue:
- `core-depth` lane: deepen active interests with high-signal, implementation-heavy content.
- `adjacent` lane: 1-hop related topics that improve judgment in the core lane.
- `far-tangent` lane: occasional 2-3 hop exploration for useful surprise.
- Suggested composition:
- `~70%` core-depth
- `~20%` adjacent
- `~10%` far-tangent (usually one item)
- Product intent: each issue should feel progressively smarter, not repetitive or generic.

## Controlled Exploration Scheduling
- Make far-tangent exploration occasional, not constant.
- Example policy:
- default: one far-tangent item every 2-3 issues
- increase exploration when user signals positive novelty response
- decrease exploration quickly when user signals irrelevance
- This prevents noise while preserving "magic" moments.

## Fast Feedback UX: In-Email Preference Buttons
- Add lightweight feedback controls directly in each email item:
- `More like this`
- `Less like this`
- Why:
- lowers friction versus writing full replies
- increases feedback frequency and signal density
- gives cleaner structured preference events for ranking/memory updates
- V1 implementation direction:
- signed click links (idempotent event processing)
- append structured feedback events to per-user preference memory
- blend with reply-text updates (buttons for speed, replies for nuance)
- Guardrail:
- avoid overfitting to one click; use bounded weight updates and decay.

## Diversity Promotion in Every Issue
- Problem:
- issues can still feel narrow when many selected links cluster around one subtopic, source ecosystem, or viewpoint.
- Product goal:
- enforce visible breadth in each email while preserving user-fit quality.
- Implementation direction:
- add a diversity-aware reranker after candidate scoring with explicit constraints:
- per-issue max items per domain family
- per-issue max items per dominant topic cluster
- minimum lane coverage across `core-depth`, `adjacent`, and exploration picks
- add novelty-distance penalty when multiple items are semantically too similar
- Quality guardrail:
- diversity should not inject low-quality links; fallback to fewer items over low-signal filler when constraint satisfaction fails.

## 2. "Rabbit Hole" Mode (Serialized Anticipation)
When someone gets interested in a highly technical or niche subject (for example optimizing search algorithms, aerodynamics physics, or the history of the Roman Republic), a single article is never enough.

- The Mechanic:
- if the system detects a user explicitly asked for or repeatedly clicked into a new dense topic, trigger a `Rabbit Hole`
- instead of random daily links, serialize the learning path across days
- example sequence:
- Tuesday: `The 101 Primer`
- Wednesday: `The current state of the art`
- Thursday: `The biggest unsolved problem in the field`
- Why it's addictive:
- leverages the Zeigarnik effect (people remember incomplete tasks)
- serialized deep dives create concrete anticipation for tomorrow's issue
- users want to complete the sequence

## 3. The Friday "Brain Map" (Identity and Switching Cost)
Target users take pride in broad curiosity, so the product should reflect that identity back to them.

- The Mechanic:
- replace the standard Friday issue with a weekly `Brain Map`
- summarize that user's intellectual trajectory for the week
- example:
- "This week, you went deep on quantum computing, explored Machiavelli's letters, and discovered biomimicry. You've entered the top 5% of readers exploring the intersection of history and tech."
- Why it's addictive:
- people are drawn to personalized data reflections (similar behavioral pull to wrap-style products)
- creates strong switching cost: leaving the product means losing the evolving mirror of how their mind is changing

## Curiosity Graph Concept
- Maintain a per-user graph:
- nodes: topics, subtopics, domains, source types
- edges: co-interest strength, reply feedback, recurring bridges
- Use graph distance + confidence to propose adjacent and far-tangent candidates.
- Rank by "surprise-with-fit" score (novel but still plausibly relevant).

## Long-Horizon Preference Graph (Evolving Mind Model)
- As users spend more time in the system, the preference representation should become richer.
- Treat interaction history as a growing organism of the user's mind, where interests branch and reconnect over time.
- Model exploration as the `adjacent possible`: recommend what is one step beyond current interests, not random novelty.
- Practical interpretation:
- graph should evolve from repeated behaviors (click feedback, replies, reading patterns, send outcomes)
- stable identity clusters stay anchored while frontier nodes expand dynamically
- selection policy should balance:
- identity anchor (long-term core interests)
- local drift (short-term curiosity)
- adjacent-possible frontier (plausible next interests)

## 5. The "Forward to Train" Loop (External Friction)
Sometimes the easiest way for a user to tell the system what they want is to show what they are already reading outside the newsletter.

- Concept:
- provide a dedicated email address (for example `brain@yourdomain.com`)
- users forward interesting links from Hacker News, Reddit, Twitter/X, etc.
- system parses forwarded links, extracts core concepts, and updates user preference state
- Why it works:
- turns product behavior from passive delivery into active knowledge-vault learning
- captures high-signal intent without requiring manual preference authoring
- Implementation direction:
- add inbound forwarding mailbox + webhook path
- parse URLs and canonicalize domains/topics
- apply bounded updates into preference graph/memory (with overfit guardrails)

## Can We Embed Curiosity Graph Into Bloom?
Short answer: partially, with a hybrid model.

- Bloom is excellent for:
- cheap membership checks (`seen` vs `not seen`)
- anti-repeat suppression at scale
- Bloom cannot do:
- recoverable history (you cannot list what was seen)
- weighted relationships between topics (graph edges)
- direct curiosity prediction logic

Recommended efficient hybrid:
- keep Bloom as L0 anti-repeat gate (`sent_url_bloom_bits`)
- add tiny recoverable context store for graph features:
- recent canonical URLs/topics/domains (bounded window)
- lightweight edge weights (`topic_a -> topic_b`, confidence, last_seen_at)
- optional compact approximations for frequency (Count-Min Sketch / HLL style counters) where useful

Result:
- near-Bloom efficiency for suppression
- enough structured memory for curiosity prediction and exploration control

## Agentic "Learns to Learn" Loop
- Build an agentic policy loop that updates per-user exploration behavior from outcomes:
- inputs: reply text, skip/positive signals, novelty acceptance patterns
- policy updates: lane weights, tangent frequency, domain boosts/penalties
- objective: maximize long-run user-perceived value, not just click-through.

## Implementation Sketch (Phased)
1. Add lane-aware topic planning (`core-depth`, `adjacent`, `far-tangent`).
2. Add controlled exploration scheduler with simple thresholds.
3. Add minimal recoverable history store (do not replace Bloom).
4. Introduce curiosity-graph scoring for candidate ranking.
5. Add evaluation metrics: generic-rate, novelty acceptance, progression quality.

## Open Questions
- What is the minimum viable signal set for curiosity prediction without heavy tracking?
- Which user feedback events should directly update exploration policy?
- How far can tangent go before usefulness drops for this product's audience?

## Messaging Notes
- Prior onboarding payment copy (kept for reference/reuse):
- "Quick note: it's $5/month. You won't pay anything today. Your first invoice comes in two weeks, and if you decide not to continue, that's totally fine, no penalty."

## Personalization Signal Idea
- Use user data to improve recommendation quality.
- Candidate signals: explicit onboarding preferences, reply updates, click/open behavior, send-time engagement, topic-level positive/negative feedback, and (with explicit opt-in) browsing-interest signals.
- Expansion option: evaluate licensed third-party audience/interest datasets from data providers to enrich cold-start topic understanding.
- Guardrails: require clear consent, legal/compliance review, transparent disclosure, reversible controls, and strict minimization so short-term noise or invasive tracking does not degrade trust.
