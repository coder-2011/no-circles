import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MEMORY_WORD_CAP,
  countWords,
  hasRequiredHeaders,
  parseSections,
  validateMemoryText
} from "@/lib/memory/contract";
import {
  buildFallbackOnboardingMemory,
  buildFallbackReplyMemory,
  mergeReplyIntoMemory
} from "@/lib/memory/processors";

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
const originalAnthropicMemoryModel = process.env.ANTHROPIC_MEMORY_MODEL;

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
  process.env.ANTHROPIC_MEMORY_MODEL = originalAnthropicMemoryModel;
});

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

describe("structured reply memory updates", () => {
  it("applies validated model ops deterministically", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MEMORY_MODEL = "claude-3-5-sonnet-20240620";

    const modelOps = {
      add_active: ["economics"],
      add_suppressed: ["crypto"],
      remove_active: [],
      remove_suppressed: [],
      personality_add: ["prefers concise summaries"],
      personality_remove: [],
      recent_feedback_add: ["Wants more economics and less crypto"]
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: JSON.stringify(modelOps) }]
        })
      }))
    );

    const currentMemory = [
      "PERSONALITY:",
      "- Curious engineer",
      "",
      "ACTIVE_INTERESTS:",
      "- AI",
      "- Crypto",
      "",
      "SUPPRESSED_INTERESTS:",
      "-",
      "",
      "RECENT_FEEDBACK:",
      "- Likes practical examples"
    ].join("\n");

    const updated = await mergeReplyIntoMemory(currentMemory, "More economics, less crypto.");
    const sections = parseSections(updated);

    expect(sections).not.toBeNull();
    expect(updated).toContain("ACTIVE_INTERESTS:");
    expect(sections?.ACTIVE_INTERESTS.toLowerCase()).toContain("economics");
    expect(sections?.ACTIVE_INTERESTS.toLowerCase()).not.toContain("crypto");
    expect(updated).toContain("SUPPRESSED_INTERESTS:");
    expect(sections?.SUPPRESSED_INTERESTS.toLowerCase()).toContain("crypto");
    expect(updated).toContain("PERSONALITY:");
    expect(sections?.PERSONALITY.toLowerCase()).toContain("prefers concise summaries");
    expect(countWords(updated)).toBeLessThanOrEqual(MEMORY_WORD_CAP + 1);
  });

  it("falls back when model returns invalid json", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "not-json" }]
        })
      }))
    );

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

    const updated = await mergeReplyIntoMemory(currentMemory, "I want less crypto and more economics.");
    const fallback = buildFallbackReplyMemory(currentMemory, "I want less crypto and more economics.");

    expect(updated).toEqual(fallback);
  });
});
