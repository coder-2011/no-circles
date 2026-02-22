import { describe, expect, it } from "vitest";
import { deriveTopicsFromMemory } from "@/lib/discovery/topic-derivation";

describe("deriveTopicsFromMemory", () => {
  it("derives unique topics from ACTIVE_INTERESTS and uses topic-focused queries", () => {
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
    expect(topics[0].query).toBe("AI engineering");
    expect(topics[1].query).toBe("philosophy");
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

  it("returns empty list for invalid memory and falls back to personality/feedback when active is empty", () => {
    const missingHeaders = deriveTopicsFromMemory({ interestMemoryText: "ACTIVE_INTERESTS:\n- AI" });
    const noActive = deriveTopicsFromMemory({
      interestMemoryText: [
        "PERSONALITY:",
        "- distributed systems",
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
    expect(noActive.length).toBeGreaterThanOrEqual(1);
    expect(noActive[0]?.topic).toContain("distributed systems");
  });

  it("splits merged topic bullets into distinct topics", () => {
    const memory = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- AI engineering - distributed systems - software architecture",
      "",
      "SUPPRESSED_INTERESTS:",
      "- software architecture - observability",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const topics = deriveTopicsFromMemory({ interestMemoryText: memory, maxTopics: 10 });
    const topicNames = topics.map((topic) => topic.topic.toLowerCase());

    expect(topicNames).toContain("ai engineering");
    expect(topicNames).toContain("distributed systems");
    expect(topicNames).toContain("software architecture");
    expect(topicNames).not.toContain("observability");
    expect(topics.find((topic) => topic.topic.toLowerCase() === "software architecture")?.softSuppressed).toBe(true);
  });

  it("prioritizes core topics ahead of [side] topics", () => {
    const memory = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- AI engineering",
      "- [side] crypto markets",
      "- distributed systems",
      "- [side] startup ops",
      "",
      "SUPPRESSED_INTERESTS:",
      "-",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const topics = deriveTopicsFromMemory({ interestMemoryText: memory, maxTopics: 10 });
    const topicNames = topics.map((topic) => topic.topic.toLowerCase());

    expect(topicNames[0]).toBe("ai engineering");
    expect(topicNames[1]).toBe("distributed systems");
    expect(topicNames[2]).toBe("crypto markets");
    expect(topicNames[3]).toBe("startup ops");
  });
});
