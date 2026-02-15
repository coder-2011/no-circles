import { describe, expect, it } from "vitest";
import { MEMORY_WORD_CAP, countWords, hasRequiredHeaders, validateMemoryText } from "@/lib/memory/contract";
import { buildFallbackOnboardingMemory, buildFallbackReplyMemory } from "@/lib/memory/processors";

describe("memory contract", () => {
  it("accepts canonical memory headers", () => {
    const memory = [
      "PERSONALITY:",
      "- Curious builder",
      "",
      "ACTIVE_INTERESTS:",
      "- AI",
      "",
      "SUPPRESSED_INTERESTS:",
      "- Crypto",
      "",
      "RECENT_FEEDBACK:",
      "- Wants less crypto"
    ].join("\n");

    const parsed = validateMemoryText(memory);

    expect(parsed.ok).toBe(true);
    expect(hasRequiredHeaders(memory)).toBe(true);
  });

  it("enforces the 800-word cap", () => {
    const memory = [
      "PERSONALITY:",
      "- word",
      "",
      "ACTIVE_INTERESTS:",
      `${"token ".repeat(1200)}`,
      "",
      "SUPPRESSED_INTERESTS:",
      "-",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const parsed = validateMemoryText(memory);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(countWords(parsed.memoryText)).toBeLessThanOrEqual(MEMORY_WORD_CAP + 1);
    }
  });
});

describe("fallback memory processors", () => {
  it("creates canonical onboarding memory", () => {
    const memory = buildFallbackOnboardingMemory("AI, software engineering, philosophy, economics");

    expect(hasRequiredHeaders(memory)).toBe(true);
    expect(countWords(memory)).toBeLessThanOrEqual(MEMORY_WORD_CAP + 1);
  });

  it("creates canonical reply memory with suppression signals", () => {
    const currentMemory = [
      "PERSONALITY:",
      "- Curious engineer",
      "",
      "ACTIVE_INTERESTS:",
      "- AI",
      "",
      "SUPPRESSED_INTERESTS:",
      "-",
      "",
      "RECENT_FEEDBACK:",
      "-"
    ].join("\n");

    const updated = buildFallbackReplyMemory(currentMemory, "I want more economics and less crypto.");

    expect(hasRequiredHeaders(updated)).toBe(true);
    expect(updated.toLowerCase()).toContain("less crypto");
  });
});
