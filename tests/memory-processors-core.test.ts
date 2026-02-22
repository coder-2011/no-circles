import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEMORY_WORD_CAP,
  countWords,
  hasRequiredHeaders,
  validateMemoryText
} from "@/lib/memory/contract";
import {
  buildFallbackOnboardingMemory,
  buildFallbackReplyMemory,
  formatOnboardingMemory
} from "@/lib/memory/processors";

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
const originalAnthropicMemoryModel = process.env.ANTHROPIC_MEMORY_MODEL;

afterEach(() => {
  vi.restoreAllMocks();
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

  it("creates canonical reply memory while preserving suppressed list on fallback", () => {
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
    expect(updated).toContain("SUPPRESSED_INTERESTS:");
  });
});

describe("onboarding model requirement", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_MEMORY_MODEL = "claude-opus-4-6";
  });

  it("throws when memory model env is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MEMORY_MODEL = "";

    await expect(formatOnboardingMemory("Robotics, mechanistic interpretability.")).rejects.toThrow(
      "ONBOARDING_MODEL_REQUIRED"
    );
  });

  it("throws explicit auth error for model 401", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({})
      }))
    );

    await expect(formatOnboardingMemory("I care about robotics.")).rejects.toThrow("ANTHROPIC_AUTH_FAILED");
  });

  it("throws when onboarding model output is unavailable and fallback would be used", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({})
      }))
    );

    await expect(
      formatOnboardingMemory("I care about robotics and mechanistic interpretability.")
    ).rejects.toThrow("ONBOARDING_MODEL_REQUIRED");
  });
});
