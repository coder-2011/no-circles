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

  it("instructs intensity inference with core/side/suppressed outcomes", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- AI", "less ai");

    expect(prompt).toContain("Interest intensity inference:");
    expect(prompt).toContain("Infer user intent probabilistically from wording and context");
    expect(prompt).toContain("move_core_to_side");
    expect(prompt).toContain("move_side_to_core");
    expect(prompt).toContain("For uncertain language, prefer reversible changes (side lane) over suppression.");
  });

  it("includes hard-stop cascade guidance for parent/subtopic cases", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- philosophy of physics", "scrap philosophy");

    expect(prompt).toContain("Hierarchy and overlap handling (hard constraints):");
    expect(prompt).toContain("If user hard-stops a parent topic, also hard-stop active subtopics");
    expect(prompt).toContain("Example: 'scrap philosophy' should also remove/suppress 'philosophy of physics'.");
    expect(prompt).toContain("If user hard-stops a subtopic only, do not remove parent or sibling topics");
  });
});
