import { describe, expect, it } from "vitest";
import { buildReplyMemoryPrompt } from "@/lib/ai/memory-prompts";

describe("buildReplyMemoryPrompt", () => {
  it("includes hard section-ownership constraints to reduce cross-section duplication", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n-\nSUPPRESSED_INTERESTS:\n-", "less ai");

    expect(prompt).toContain("Section ownership (hard constraints):");
    expect(prompt).toContain("PERSONALITY is for stable user traits only");
    expect(prompt).toContain("A topic must have one home at a time");
    expect(prompt).toContain("Do not duplicate the same topic idea across multiple sections");
  });

  it("distinguishes soft downweight from hard suppression", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- AI", "less ai");

    expect(prompt).toContain("Soft vs hard intent handling:");
    expect(prompt).toContain("Interpret intent semantically, not by exact phrase matching.");
    expect(prompt).toContain("Soft downweight intent (for example: 'less X', 'not much more X', 'tone down X', 'reduce X')");
    expect(prompt).toContain("Do not interpret soft downweight language as full suppression.");
  });

  it("includes hard-stop cascade guidance for parent/subtopic cases", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- philosophy of physics", "scrap philosophy");

    expect(prompt).toContain("Hierarchy and overlap handling (hard constraints):");
    expect(prompt).toContain("If user hard-stops a parent topic, also hard-stop active subtopics");
    expect(prompt).toContain("Example: 'scrap philosophy' should also remove/suppress 'philosophy of physics'.");
    expect(prompt).toContain("If user hard-stops a subtopic only, do not remove parent or sibling topics");
  });
});
