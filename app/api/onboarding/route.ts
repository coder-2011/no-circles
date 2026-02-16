import { NextResponse } from "next/server";
import { getAuthenticatedUserEmail } from "@/lib/auth/server-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { formatOnboardingMemory } from "@/lib/memory/processors";
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

  let authenticatedEmail: string | null = null;

  try {
    authenticatedEmail = await getAuthenticatedUserEmail();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error_code: "INTERNAL_ERROR",
        message: "Failed to resolve authenticated user."
      },
      { status: 500 }
    );
  }

  if (!authenticatedEmail) {
    return NextResponse.json(
      { ok: false, error_code: "UNAUTHORIZED", message: "Unauthorized." },
      { status: 401 }
    );
  }

  const { preferred_name, timezone, send_time_local, brain_dump_text } = parsed.data;
  let interestMemoryText = "";

  try {
    interestMemoryText = await formatOnboardingMemory(brain_dump_text);
  } catch (error) {
    if (error instanceof Error && error.message === "ANTHROPIC_AUTH_FAILED") {
      return NextResponse.json(
        {
          ok: false,
          error_code: "MODEL_AUTH_ERROR",
          message: "Anthropic authentication failed. Check server API key env and restart dev server."
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to process onboarding memory." },
      { status: 500 }
    );
  }

  try {
    const [upsertedUser] = await db
      .insert(users)
      .values({
        email: authenticatedEmail,
        preferredName: preferred_name,
        timezone,
        sendTimeLocal: send_time_local,
        interestMemoryText
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          preferredName: preferred_name,
          timezone,
          sendTimeLocal: send_time_local,
          interestMemoryText
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
