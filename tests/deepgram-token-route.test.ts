import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserEmailMock, fetchMock } = vi.hoisted(() => {
  const getAuthenticatedUserEmail = vi.fn();
  const fetch = vi.fn();

  return {
    getAuthenticatedUserEmailMock: getAuthenticatedUserEmail,
    fetchMock: fetch
  };
});

vi.mock("@/lib/auth/server-user", () => ({
  getAuthenticatedUserEmail: getAuthenticatedUserEmailMock
}));

import { GET } from "@/app/api/deepgram/token/route";

describe("GET /api/deepgram/token", () => {
  const originalDeepgramApiKey = process.env.DEEPGRAM_API_KEY;

  beforeEach(() => {
    getAuthenticatedUserEmailMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.DEEPGRAM_API_KEY = "dg_test_key";
    getAuthenticatedUserEmailMock.mockResolvedValue("signed-in@example.com");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "token-123", expires_in: 30 })
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    if (originalDeepgramApiKey === undefined) {
      delete process.env.DEEPGRAM_API_KEY;
      return;
    }

    process.env.DEEPGRAM_API_KEY = originalDeepgramApiKey;
  });

  it("returns 401 when user is not authenticated", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error_code: "UNAUTHORIZED", message: "Sign in required." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 500 when DEEPGRAM_API_KEY is missing", async () => {
    delete process.env.DEEPGRAM_API_KEY;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error_code: "MISSING_CONFIG",
      message: "Deepgram API key is not configured."
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns token payload on success", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, access_token: "token-123", expires_in: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: "Token dg_test_key",
        "Content-Type": "application/json"
      },
      body: "{}"
    });
  });

  it("returns 502 when Deepgram token grant fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error_code: "DEEPGRAM_TOKEN_FAILED",
      message: "Failed to create Deepgram access token: Deepgram token endpoint rejected request."
    });
  });

  it("returns 502 when Deepgram response is missing access_token", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ expires_in: 30 })
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error_code: "DEEPGRAM_TOKEN_FAILED",
      message: "Failed to create Deepgram access token."
    });
  });

  it("returns 502 when Deepgram grant request throws", async () => {
    fetchMock.mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error_code: "DEEPGRAM_TOKEN_FAILED",
      message: "Failed to create Deepgram access token: Deepgram token endpoint rejected request."
    });
  });

  it("returns upstream Deepgram error message when provided", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ err_code: "FORBIDDEN", err_msg: "Insufficient permissions." })
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error_code: "DEEPGRAM_TOKEN_FAILED",
      message: "Failed to create Deepgram access token: Insufficient permissions."
    });
  });
});
