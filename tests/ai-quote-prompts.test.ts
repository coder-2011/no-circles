import { describe, expect, it } from "vitest";
import { buildQuoteSelectionUserPrompt, QUOTE_SELECTION_SYSTEM_PROMPT } from "@/lib/ai/quote-prompts";

describe("quote prompts", () => {
  it("uses a role-only system prompt and keeps task contract in user prompt", () => {
    expect(QUOTE_SELECTION_SYSTEM_PROMPT).toContain("seasoned literary editor");
    expect(QUOTE_SELECTION_SYSTEM_PROMPT).not.toContain("Output strict JSON only");

    const prompt = buildQuoteSelectionUserPrompt({
      personalitySection: "- practical\n- likes concrete detail",
      recentFeedbackSection: "- less hype\n- more first-principles",
      candidates: [
        {
          index: 1,
          text: "A practical quote.",
          author: "Author One",
          category: "pragmatism"
        },
        {
          index: 2,
          text: "Another quote.",
          author: "Author Two",
          category: null
        }
      ]
    });

    expect(prompt).toContain("Output strict JSON only");
    expect(prompt).toContain('"selected_index": <1-based integer>');
    expect(prompt).toContain("Reader profile (PERSONALITY):");
    expect(prompt).toContain("Most recent steering (RECENT_FEEDBACK):");
    expect(prompt).toContain("1.\nQUOTE: A practical quote.");
    expect(prompt).toContain("AUTHOR: Author Two");
  });
});
