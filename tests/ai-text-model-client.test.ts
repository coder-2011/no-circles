import { afterEach, describe, expect, it, vi } from "vitest";
import { callAnthropicCompatibleTextModel } from "@/lib/ai/text-model-client";

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
});

describe("callAnthropicCompatibleTextModel", () => {
  it("falls back to Anthropic when OpenRouter auth fails", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: "text", text: "hello from fallback" }]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await callAnthropicCompatibleTextModel({
      systemPrompt: "system",
      userPrompt: "user",
      model: "qwen/qwen3-235b-a22b-2507",
      fallbackModel: "claude-haiku-4-5",
      maxTokens: 32,
      temperature: 0,
      missingApiKeyError: "MISSING_KEY",
      invalidResponseError: "INVALID",
      emptyResponseError: "EMPTY",
      httpErrorPrefix: "HTTP_",
      authErrorCode: "AUTH_FAILED"
    });

    expect(result).toBe("hello from fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/messages");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.anthropic.com/v1/messages");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).model).toBe("qwen/qwen3-235b-a22b-2507");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).model).toBe("claude-haiku-4-5");
  });

  it("keeps auth failure when no Anthropic fallback exists", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    delete process.env.ANTHROPIC_API_KEY;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({})
      }))
    );

    await expect(
      callAnthropicCompatibleTextModel({
        systemPrompt: "system",
        userPrompt: "user",
        model: "qwen/qwen3-235b-a22b-2507",
        maxTokens: 32,
        temperature: 0,
        missingApiKeyError: "MISSING_KEY",
        invalidResponseError: "INVALID",
        emptyResponseError: "EMPTY",
        httpErrorPrefix: "HTTP_",
        authErrorCode: "AUTH_FAILED"
      })
    ).rejects.toThrow("AUTH_FAILED");
  });
});
