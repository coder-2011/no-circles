import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cronGenerateNextSchema } from "@/lib/schemas";

const CRON_ROUTE = "POST /api/cron/generate-next";

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
    const selectedUser = await db.transaction(async (tx) => {
      const result = await tx.execute<{ id: string }>(sql`
        select u.id
        from users u
        where
          (
            (timezone(u.timezone, ${runAtUtc}::timestamptz))::time >=
            make_time(
              split_part(u.send_time_local, ':', 1)::int,
              split_part(u.send_time_local, ':', 2)::int,
              0
            )
          )
          and (
            u.last_issue_sent_at is null
            or (timezone(u.timezone, u.last_issue_sent_at))::date <
               (timezone(u.timezone, ${runAtUtc}::timestamptz))::date
          )
        order by u.last_issue_sent_at asc nulls first, u.id asc
        for update skip locked
        limit 1
      `);

      return result.rows[0] ?? null;
    });

    if (!selectedUser) {
      console.info("[cron.generate-next] no_due_user", {
        route: CRON_ROUTE,
        run_at_utc: runAtUtc.toISOString()
      });
      return NextResponse.json({ ok: true, status: "no_due_user" });
    }

    console.info("[cron.generate-next] selected", {
      route: CRON_ROUTE,
      run_at_utc: runAtUtc.toISOString(),
      user_id: selectedUser.id
    });

    return NextResponse.json({ ok: true, status: "selected", user_id: selectedUser.id });
  } catch (error) {
    console.error("[cron.generate-next] error", { route: CRON_ROUTE, error });
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to select due user." },
      { status: 500 }
    );
  }
}
