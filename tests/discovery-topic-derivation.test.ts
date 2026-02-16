import { describe, expect, it } from "vitest";
import { deriveTopicsFromMemory } from "@/lib/discovery/topic-derivation";

describe("deriveTopicsFromMemory", () => {
  it("derives unique topics from ACTIVE_INTERESTS and includes personality/feedback context", () => {
    const memory = [
      "PERSONALITY:",
      "- prefers practical tutorials",
      "",
      "ACTIVE_INTERESTS:",
      "- AI engineering",
      "- AI engineering",
      "- philosophy",
      "",
      "SUPPRESSED_INTERESTS:",
      "- crypto",
      "",
      "RECENT_FEEDBACK:",
      "- wants less hype"
    ].join("\n");

    const topics = deriveTopicsFromMemory({ interestMemoryText: memory, maxTopics: 10 });

    expect(topics).toHaveLength(2);
    expect(topics[0].topic).toBe("AI engineering");
    expect(topics[1].topic).toBe("philosophy");
    expect(topics[0].query).toContain("prefers practical tutorials");
    expect(topics[0].query).toContain("wants less hype");
  });

  it("soft-suppresses matching topics instead of removing them", () => {
    const memory = [
      "PERSONALITY:",
      "- curious",
      "",
      "ACTIVE_INTERESTS:",
      "- crypto",
      "- AI",
      "",
      "SUPPRESSED_INTERESTS:",
      "- crypto",
      "",
      "RECENT_FEEDBACK:",
      "- less crypto"
    ].join("\n");

    const topics = deriveTopicsFromMemory({ interestMemoryText: memory, maxTopics: 10 });

    expect(topics).toHaveLength(2);
    expect(topics[0].topic).toBe("AI");
    expect(topics[0].softSuppressed).toBe(false);
    expect(topics[1].topic).toBe("crypto");
    expect(topics[1].softSuppressed).toBe(true);
  });

  it("returns empty list when memory is invalid or has no active topics", () => {
    const missingHeaders = deriveTopicsFromMemory({ interestMemoryText: "ACTIVE_INTERESTS:\n- AI" });
    const noActive = deriveTopicsFromMemory({
      interestMemoryText: [
        "PERSONALITY:",
        "- curious",
        "",
        "ACTIVE_INTERESTS:",
        "-",
        "",
        "SUPPRESSED_INTERESTS:",
        "-",
        "",
        "RECENT_FEEDBACK:",
        "-"
      ].join("\n")
    });

    expect(missingHeaders).toEqual([]);
    expect(noActive).toEqual([]);
  });
});
