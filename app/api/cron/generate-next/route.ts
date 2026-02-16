import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cronGenerateNextSchema } from "@/lib/schemas";
import { sendUserNewsletter } from "@/lib/pipeline/send-user-newsletter";

const CRON_ROUTE = "POST /api/cron/generate-next";
const LEASE_TTL_MINUTES = 5;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return false;
  }

  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[cron.generate-next] unauthorized", { route: CRON_ROUTE });
    return NextResponse.json(
      { ok: false, error_code: "UNAUTHORIZED", message: "Unauthorized." },
      { status: 401 }
    );
  }

  const json = await request.json().catch(() => ({}));
  const parsed = cronGenerateNextSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_code: "INVALID_PAYLOAD", message: "Invalid cron payload." },
      { status: 400 }
    );
  }

  const runAtUtc = parsed.data.run_at_utc ? new Date(parsed.data.run_at_utc) : new Date();

  try {
    const selectionResult = await db.execute<{ user_id: string | null }>(sql`
      select public.claim_next_due_user(
        ${runAtUtc}::timestamptz,
        ${LEASE_TTL_MINUTES}::int
      ) as user_id
    `);

    const selectedUserId = selectionResult.rows[0]?.user_id ?? null;

    if (!selectedUserId) {
      console.info("[cron.generate-next] no_due_user", {
        route: CRON_ROUTE,
        run_at_utc: runAtUtc.toISOString()
      });
      return NextResponse.json({ ok: true, status: "no_due_user" });
    }

    console.info("[cron.generate-next] selected", {
      route: CRON_ROUTE,
      run_at_utc: runAtUtc.toISOString(),
      user_id: selectedUserId
    });

    const pipelineResult = await sendUserNewsletter({
      userId: selectedUserId,
      runAtUtc
    });

    if (pipelineResult.status === "sent") {
      return NextResponse.json({
        ok: true,
        status: "sent",
        user_id: selectedUserId,
        provider_message_id: pipelineResult.providerMessageId ?? null
      });
    }

    if (pipelineResult.status === "insufficient_content") {
      console.warn("[cron.generate-next] insufficient_content", {
        route: CRON_ROUTE,
        run_at_utc: runAtUtc.toISOString(),
        user_id: selectedUserId,
        error: pipelineResult.error
      });

      return NextResponse.json({
        ok: true,
        status: "insufficient_content",
        user_id: selectedUserId
      });
    }

    if (pipelineResult.status === "send_failed") {
      console.error("[cron.generate-next] send_failed", {
        route: CRON_ROUTE,
        run_at_utc: runAtUtc.toISOString(),
        user_id: selectedUserId,
        error: pipelineResult.error
      });

      return NextResponse.json({
        ok: true,
        status: "send_failed",
        user_id: selectedUserId
      });
    }

    console.error("[cron.generate-next] pipeline_internal_error", {
      route: CRON_ROUTE,
      run_at_utc: runAtUtc.toISOString(),
      user_id: selectedUserId,
      error: pipelineResult.error
    });

    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to process selected user." },
      { status: 500 }
    );
  } catch (error) {
    console.error("[cron.generate-next] error", { route: CRON_ROUTE, error });
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to select due user." },
      { status: 500 }
    );
  }
}
