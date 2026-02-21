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
    NODE_ENV: process.env.NODE_ENV,
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
    process.env.NODE_ENV = "production";
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

  it("uses callback_origin localhost override when callback request lands on production domain", async () => {
    process.env.NODE_ENV = "production";
    const request = new Request(
      "https://www.no-circles.com/auth/callback?next=/onboarding&callback_origin=http%3A%2F%2Flocalhost%3A3000",
      {
        method: "GET"
      }
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("never rewrites localhost callback requests to production origin, even in production mode", async () => {
    process.env.NODE_ENV = "production";
    const request = new Request("http://localhost:3000/auth/callback?next=/onboarding", {
      method: "GET",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "www.no-circles.com"
      }
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("ignores forwarded host in non-production and uses request origin", async () => {
    process.env.NODE_ENV = "test";
    const request = new Request("http://localhost:3000/auth/callback?next=/onboarding", {
      method: "GET",
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "www.no-circles.com"
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
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });
});
