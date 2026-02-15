import { NextResponse } from "next/server";
import { onboardingSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_code: "INVALID_PAYLOAD", message: "Invalid onboarding payload." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, user_id: "TODO" });
}
