import { NextResponse } from "next/server";
import { getAuthenticatedUserEmail } from "@/lib/auth/server-user";

export async function GET() {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail();
    if (!authenticatedEmail) {
      return NextResponse.json(
        { ok: false, error_code: "UNAUTHORIZED", message: "Sign in required." },
        { status: 401 }
      );
    }

    const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error_code: "MISSING_CONFIG", message: "Deepgram API key is not configured." },
        { status: 500 }
      );
    }

    const grantResponse = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    }).catch(() => null);

    if (!grantResponse?.ok) {
      return NextResponse.json(
        { ok: false, error_code: "DEEPGRAM_TOKEN_FAILED", message: "Failed to create Deepgram access token." },
        { status: 502 }
      );
    }

    const grantBody = (await grantResponse.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number }
      | null;

    if (!grantBody?.access_token) {
      return NextResponse.json(
        { ok: false, error_code: "DEEPGRAM_TOKEN_FAILED", message: "Failed to create Deepgram access token." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, access_token: grantBody.access_token, expires_in: grantBody.expires_in ?? null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to issue dictation token." },
      { status: 500 }
    );
  }
}
