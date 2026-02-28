# Product Vision: Personalized Daily Newsletter

## Core Vision
Build an email newsletter that is customized to the individual every morning. The product should feel like a high-quality, TLDR-style curation feed, but personalized to what the user currently cares about.

Core promise: give the user a high-signal brief tailored to what they care about today.

This is a curation product, not an opinion product.

## Product Outcome
- Every morning, the user receives one personalized email newsletter.
- The newsletter includes curated links to useful articles the user is likely to care about.
- Every newsletter should include a small amount of discovery content: things the user is not explicitly asking for, but is likely to find interesting.
- The user can reply to that email in natural language to update interests for the next day.
- Interests evolve purely user-directed based on replies.

Example user control via reply:
- “I’m not really interested in dev ops anymore.”
- “I want to learn more about agile practices and Machiavelli.”

## Editorial Style (Final)
- Neutral, purely informational style.
- No hot takes from the AI.
- No AI opinions, no “thought leadership,” no bias injection.
- If source articles contain controversial claims or hot takes, the newsletter may include them as reported, as long as they are from credible sources.
- Content should still be interesting: include meaningful facts, important developments, and notable ideas, without adding opinion.

## No-Slop Content Policy (Strict)
The no-slop rule is strict.

- The AI should be curating, not inventing.
- The summary should be tightly grounded in what the article actually says.
- Avoid fluffy generic AI prose.
- Keep each item short and factual, TLDR-style.
- Link to longer original articles; the email is a concise briefing layer, not a replacement for reading.

## Coverage Scope
Coverage is intentionally mixed and personalized. The user may care about:
- coding and AI (core)
- philosophy
- history
- evolutionary theory
- other rotating interests

The system should support broad and mixed curiosity, not a narrow niche feed.

## Personalization Model
- Personalization is explicitly user-directed.
- The primary control loop is email reply.
- Supported intent focus: changing topics, reinforcing topics, and steering away from topics.
- Tone should remain consistent; reply style should not cause major tone drift.
- User memory and interests should remain highly editable and dynamic over time.
- If a user says they do not want a topic, the system should remove or demote that topic quickly and avoid drifting back toward it unless the user explicitly asks for it again.

## Newsletter Composition
- Fixed target: about 10 items per daily email.
- Include breadth across interests, but do not enforce a rigid fixed split.
- Topic spread should be dynamic: some days heavier on AI/coding, other days heavier on other interests.
- This spread should feel similar to how a human’s interests shift over time.
- Each daily issue should include a small discovery slice (serendipity): adjacent topics that the user might like but did not explicitly request.
- Do not enforce a deterministic category minimum or fixed ratio.

Per item format target:
- headline/title + hyperlink
- short factual summary of the linked article in TLDR-like style, closely grounded in source phrasing
- concise, readable, neutral writing

## Discovery and Serendipity
- The product should not be limited to only explicit user-declared interests.
- Every issue should teach the user something new they are likely to care about.
- Discovery picks should be adjacent to known interests and still follow the same strict no-slop and credibility rules.
- Example adjacency: if a user likes art history and philosophy, the system might surface related history-of-music or culture pieces.

## Content Sources and Trust
- Initial source types include podcast transcripts, newsletters, research/blog content, and papers.
- Source intake should use open crawling rather than a static allowlist.
- Credibility checks are required before inclusion in the daily issue.

## Recommendation Behavior
At the end of each article block, include recommendations for what the person might like to read later.

## User Setup and Onboarding
First-time setup should be simple:
- user brain-dumps broad interests in natural language
- system starts with a varied daily mix based on that input
- user then adjusts over time by replying to emails

Cold start should prioritize flexibility and fast personalization.

## Cadence and Delivery
- Delivery cadence: daily, every morning.
- User can set preferred send time.

## Improvement and Feedback Philosophy
If the email quality is weak (“shitty”), the system should still be easy to improve through user feedback.

- Keep feedback loop simple and fast.
- Use user replies to steer future topic selection.
- Product should improve toward perceived value, not toward sounding “smart.”

## Future UX Value Enhancements (Planned)
These additions are aligned with the product vision and are candidates for future implementation:

1. Pre-send preview during onboarding
- Let users preview a sample issue before first save.

2. Clear delivery status transparency
- Show users when the last issue was sent and when the next one is scheduled.

3. Fast feedback controls
- Add one-tap feedback options (`more like this`, `less like this`, `too basic`, `too advanced`).

4. Source preference controls
- Let users influence source style/quality mix based on trust and depth preference.

5. Starter onboarding templates
- Offer optional presets to reduce blank-page friction during first setup.

6. Adjustable digest intensity
- Allow users to choose how dense each daily issue should be.

## Success Definition
Product-market fit is defined by user value:
- Does the user enjoy reading it?
- Does it fulfill curiosity the way they wanted?
- Does it remain useful as interests change?

## Distribution and Business Direction
Current direction:
- Build great software first.
- Open source by default.
- Commercialization is optional and may come later.

## Explicit Non-Goals (Current)
- Not focusing on architecture/library choices in this vision document.
- No AI opinion-writing layer.
- No complex tone personalization system.
- No mandatory correction-loop product flow defined at this stage.
- No separate reviewer model in V1; summary generation is single-pass writer-driven.
