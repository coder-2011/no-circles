import { after, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getAuthenticatedUserEmail } from "@/lib/auth/server-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { formatOnboardingMemory } from "@/lib/memory/processors";
import { onboardingSchema } from "@/lib/schemas";
import { sendUserNewsletter } from "@/lib/pipeline/send-user-newsletter";
import { logError, logWarn } from "@/lib/observability/log";

const WELCOME_ISSUE_ITEM_COUNT = 5;
const MAX_ONBOARDING_PAYLOAD_BYTES = 64 * 1024;

function isJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  return typeof contentType === "string" && contentType.toLowerCase().includes("application/json");
}

function payloadBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export async function POST(request: Request) {
  if (!isJsonContentType(request)) {
    return NextResponse.json(
      { ok: false, error_code: "UNSUPPORTED_MEDIA_TYPE", message: "Expected application/json." },
      { status: 415 }
    );
  }

  const rawBody = await request.text();
  if (payloadBytes(rawBody) > MAX_ONBOARDING_PAYLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error_code: "PAYLOAD_TOO_LARGE", message: "Onboarding payload exceeds size limit." },
      { status: 413 }
    );
  }

  const json = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return null;
    }
  })();
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
      .returning({
        id: users.id,
        wasInserted: sql<boolean>`xmax = 0`
      });

    if (upsertedUser.wasInserted) {
      after(async () => {
        try {
          const result = await sendUserNewsletter({
            userId: upsertedUser.id,
            runAtUtc: new Date(),
            targetItemCount: WELCOME_ISSUE_ITEM_COUNT,
            issueVariant: "welcome"
          });

          if (result.status !== "sent") {
            logWarn("onboarding", "welcome_issue_not_sent", {
              user_id: upsertedUser.id,
              status: result.status,
              error: result.error ?? null
            });
          }
        } catch (error) {
          logError("onboarding", "welcome_issue_failed", {
            user_id: upsertedUser.id,
            error
          });
        }
      });
    }

    return NextResponse.json({ ok: true, user_id: upsertedUser.id });
  } catch {
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to persist onboarding data." },
      { status: 500 }
    );
  }
}
