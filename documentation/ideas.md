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

## Curiosity Graph Concept
- Maintain a per-user graph:
- nodes: topics, subtopics, domains, source types
- edges: co-interest strength, reply feedback, recurring bridges
- Use graph distance + confidence to propose adjacent and far-tangent candidates.
- Rank by "surprise-with-fit" score (novel but still plausibly relevant).

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
