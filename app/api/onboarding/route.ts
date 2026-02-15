import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
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

  const { email, timezone, send_time_local, brain_dump_text } = parsed.data;

  try {
    const [upsertedUser] = await db
      .insert(users)
      .values({
        email,
        timezone,
        sendTimeLocal: send_time_local,
        interestMemoryText: brain_dump_text
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          timezone,
          sendTimeLocal: send_time_local,
          interestMemoryText: brain_dump_text
        }
      })
      .returning({ id: users.id });

    return NextResponse.json({ ok: true, user_id: upsertedUser.id });
  } catch {
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to persist onboarding data." },
      { status: 500 }
    );
  }
}
