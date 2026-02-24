import { describe, expect, it } from "vitest";
import { buildOnboardingMemoryPrompt, buildReplyMemoryPrompt } from "@/lib/ai/memory-prompts";
import { MEMORY_WORD_CAP } from "@/lib/memory/contract";

describe("buildReplyMemoryPrompt", () => {
  it("includes global memory-cap and truncation guidance", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- AI", "more ai policy");

    expect(prompt).toContain("Global memory rule:");
    expect(prompt).toContain(`${MEMORY_WORD_CAP} words`);
    expect(prompt).toContain("truncated when necessary");
  });

  it("includes hard section-ownership constraints to reduce cross-section duplication", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n-\nSUPPRESSED_INTERESTS:\n-", "less ai");

    expect(prompt).toContain("Consistency rules:");
    expect(prompt).toContain("PERSONALITY is stable traits only, not topics.");
    expect(prompt).toContain("Keep each topic in one home (active or suppressed, never both).");
    expect(prompt).toContain("Avoid duplicate entries within and across arrays.");
    expect(prompt).toContain("Hard output length rule:");
  });

  it("instructs intensity inference with core/side/suppressed outcomes", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- AI", "less ai");

    expect(prompt).toContain("Decision policy:");
    expect(prompt).toContain("Look out for acronym mentions and classify them deliberately.");
    expect(prompt).toContain("move_core_to_side");
    expect(prompt).toContain("move_side_to_core");
    expect(prompt).toContain("If uncertain between suppress vs keep, prefer reversible behavior (side lane) over suppression.");
  });

  it("includes hard-stop and re-enable suppression guidance", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- philosophy of physics", "scrap philosophy");

    expect(prompt).toContain("Suppression policy: hard stop language -> remove_active + add_suppressed.");
    expect(prompt).toContain("Re-enable language -> remove_suppressed plus add_active/add_active_core/add_active_side as implied.");
    expect(prompt).toContain('Reply: Stop startup funding news, bring crypto back.');
  });
});

describe("buildOnboardingMemoryPrompt", () => {
  it("includes hard cap and truncation instruction", () => {
    const prompt = buildOnboardingMemoryPrompt("AI, physics, biology");

    expect(prompt).toContain(`HARD LIMIT: Entire output must be <= ${MEMORY_WORD_CAP} words total.`);
    expect(prompt).toContain(`[TRUNCATED_TO_${MEMORY_WORD_CAP}_WORDS]`);
  });
});
