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
      "RECENT_FEEDBACK:",
      "- wants less hype"
    ].join("\n");

    const topics = deriveTopicsFromMemory({ interestMemoryText: memory, maxTopics: 10 });

    expect(topics).toHaveLength(2);
    expect(topics[0]).toMatchObject({ topic: "AI engineering", query: "AI engineering", softSuppressed: false });
    expect(topics[1]).toMatchObject({ topic: "philosophy", query: "philosophy", softSuppressed: false });
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
        "RECENT_FEEDBACK:",
        "- prefers practical breakdowns"
      ].join("\n")
    });

    expect(missingHeaders).toEqual([]);
    expect(noActive.length).toBeGreaterThanOrEqual(1);
    expect(noActive[0]?.topic).toContain("prefers practical breakdowns");
  });

  it("splits merged topic bullets into distinct topics", () => {
    const memory = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- AI engineering - distributed systems - software architecture",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const topics = deriveTopicsFromMemory({ interestMemoryText: memory, maxTopics: 10 });
    const topicNames = topics.map((topic) => topic.topic.toLowerCase());

    expect(topicNames).toContain("ai engineering");
    expect(topicNames).toContain("distributed systems");
    expect(topicNames).toContain("software architecture");
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

  it("keeps side topics after core topics when maxTopics trims the result", () => {
    const memory = [
      "PERSONALITY:",
      "- practical",
      "",
      "ACTIVE_INTERESTS:",
      "- AI engineering",
      "- distributed systems",
      "- [side] crypto markets",
      "- [side] startup ops",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const topics = deriveTopicsFromMemory({ interestMemoryText: memory, maxTopics: 3 });

    expect(topics.map((topic) => topic.topic)).toEqual([
      "AI engineering",
      "distributed systems",
      "crypto markets"
    ]);
  });
});
