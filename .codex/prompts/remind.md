/remind

Goal: Give a short, concise, and thorough recap of this Codex window, with emphasis on the most recent discussion and actions.

When this command is run:
1. Summarize what we discussed and did, prioritizing the most recent items first.
2. Keep it quick: target about 6-12 bullets total, each one short.
3. Include:
- `Recent Focus`: 1-2 lines on the current main objective.
- `Key Decisions`: important choices made.
- `What Changed`: files/commands/results that materially changed state.
- `Open Items`: what is still pending or unclear.
4. Output a `Context Dilution Score` from `0-100`:
- `100` = highly focused, almost everything on one clear topic.
- `0` = very scattered across unrelated topics.
- Also include a one-line reason for the score.
5. Output `Current Model`:
- Report the exact active model/tier if known from the current session context.
- If not known, write `Current Model: unknown`.

Output format:
- `Recent Focus: ...`
- `Context Dilution Score: NN/100 - ...`
- `Current Model: ...`
- `Summary:`
  - bullet list
