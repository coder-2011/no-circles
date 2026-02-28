import { describe, expect, it } from "vitest";
import {
  buildOnboardingMemoryPrompt,
  buildReplyMemoryPrompt,
  ONBOARDING_MEMORY_SYSTEM_PROMPT,
  REPLY_MEMORY_SYSTEM_PROMPT
} from "@/lib/ai/memory-prompts";
import { MEMORY_WORD_CAP } from "@/lib/memory/contract";

describe("memory system prompts", () => {
  it("defines system-like roles for onboarding and reply memory operations", () => {
    expect(ONBOARDING_MEMORY_SYSTEM_PROMPT).toContain("senior user-profile analyst");
    expect(REPLY_MEMORY_SYSTEM_PROMPT).toContain("senior memory-ops analyst");
  });
});

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
    expect(prompt).toContain("minimize blast radius and change only topics referenced by the reply.");
    expect(prompt).toContain("Avoid duplicate entries within and across arrays.");
    expect(prompt).toContain("Hard output length rule:");
  });

  it("instructs intensity inference with core/side/suppressed outcomes", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- AI", "less ai");

    expect(prompt).toContain("Decision policy:");
    expect(prompt).toContain("Look out for acronym mentions and classify them deliberately.");
    expect(prompt).toContain("move_core_to_side");
    expect(prompt).toContain("move_side_to_core");
    expect(prompt).toContain("If uncertain between keep vs reduce, prefer reversible behavior (move_core_to_side) over full removal.");
  });

  it("includes hard-stop and re-enable suppression guidance", () => {
    const prompt = buildReplyMemoryPrompt("ACTIVE_INTERESTS:\n- philosophy of physics", "scrap philosophy");

    expect(prompt).toContain("Stop policy: hard stop language -> remove_active.");
    expect(prompt).toContain("Re-enable language -> add_active/add_active_core/add_active_side as implied.");
    expect(prompt).toContain('Reply: Stop startup funding news, bring crypto back.');
  });
});

describe("buildOnboardingMemoryPrompt", () => {
  it("includes hard cap and truncation instruction", () => {
    const prompt = buildOnboardingMemoryPrompt("AI, physics, biology");

    expect(prompt).toContain(`HARD LIMIT: Entire output must be <= ${MEMORY_WORD_CAP} words total.`);
    expect(prompt).toContain(`[TRUNCATED_TO_${MEMORY_WORD_CAP}_WORDS]`);
  });

  it("keeps role framing out of the user prompt body", () => {
    const prompt = buildOnboardingMemoryPrompt("AI, physics, biology");

    expect(prompt).not.toContain("senior user-profile analyst");
    expect(prompt).toContain("Required sections and exact order:");
  });
});
