import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock, getUserMock, exchangeCodeForSessionMock, cookieStoreMock } = vi.hoisted(() => {
  const getUser = vi.fn();
  const exchangeCodeForSession = vi.fn();
  const createServerClient = vi.fn(() => ({
    auth: {
      getUser,
      exchangeCodeForSession
    }
  }));
  const cookieStore = {
    getAll: vi.fn(() => []),
    set: vi.fn()
  };

  return {
    createServerClientMock: createServerClient,
    getUserMock: getUser,
    exchangeCodeForSessionMock: exchangeCodeForSession,
    cookieStoreMock: cookieStore
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock)
}));

import { GET } from "@/app/auth/callback/route";

describe("GET /auth/callback origin resolution", () => {
  const originalEnv = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.no-circles.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    getUserMock.mockResolvedValue({ data: { user: { email: "local@example.com" } } });
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
  });

  it("prefers forwarded localhost origin over configured public site URL", async () => {
    const request = new Request("https://www.no-circles.com/auth/callback?next=/onboarding", {
      method: "GET",
      headers: {
        "x-forwarded-proto": "http",
        "x-forwarded-host": "localhost:3000"
      }
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("uses request origin for direct localhost callback requests", async () => {
    const request = new Request("http://localhost:3000/auth/callback?next=/onboarding", {
      method: "GET"
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });
});
