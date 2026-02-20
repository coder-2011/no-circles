import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cronGenerateNextSchema } from "@/lib/schemas";
import { logError, logInfo, logWarn } from "@/lib/observability/log";
import { sendUserNewsletter } from "@/lib/pipeline/send-user-newsletter";

const CRON_ROUTE = "POST /api/cron/generate-next";
const LEASE_TTL_MINUTES = 5;
const DEFAULT_BATCH_SIZE = 3;
const MAX_BATCH_CONCURRENCY = 3;

type CronPipelineStatus = "sent" | "insufficient_content" | "send_failed" | "internal_error";

type CronPipelineResult = {
  userId: string;
  status: CronPipelineStatus;
  providerMessageId: string | null;
  error: string | null;
};

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex] as T);
      }
    })
  );

  return results;
}

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
    logWarn("cron_generate_next", "unauthorized", { route: CRON_ROUTE });
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
  const batchSize = parsed.data.batch_size ?? DEFAULT_BATCH_SIZE;

  try {
    const selectionResult = await db.execute<{ user_id: string }>(sql`
      select user_id
      from public.claim_due_users_batch(
        ${runAtUtc}::timestamptz,
        ${LEASE_TTL_MINUTES}::int,
        ${batchSize}::int
      )
    `);

    const selectedUserIds = selectionResult.rows.map((row) => row.user_id).filter((value) => value.length > 0);

    if (selectedUserIds.length === 0) {
      logInfo("cron_generate_next", "no_due_user", {
        route: CRON_ROUTE,
        run_at_utc: runAtUtc.toISOString(),
        requested_batch_size: batchSize
      });
      return NextResponse.json({ ok: true, status: "no_due_user" });
    }

    logInfo("cron_generate_next", "selected_batch", {
      route: CRON_ROUTE,
      run_at_utc: runAtUtc.toISOString(),
      requested_batch_size: batchSize,
      claimed_user_count: selectedUserIds.length,
      user_ids: selectedUserIds
    });

    const perUserResults = await runWithConcurrency(selectedUserIds, MAX_BATCH_CONCURRENCY, async (selectedUserId) => {
      const pipelineResult = await sendUserNewsletter({
        userId: selectedUserId,
        runAtUtc
      });

      if (pipelineResult.status === "sent") {
        return {
          userId: selectedUserId,
          status: "sent",
          providerMessageId: pipelineResult.providerMessageId ?? null,
          error: null
        } satisfies CronPipelineResult;
      }

      if (pipelineResult.status === "insufficient_content") {
        logWarn("cron_generate_next", "insufficient_content", {
          route: CRON_ROUTE,
          run_at_utc: runAtUtc.toISOString(),
          user_id: selectedUserId,
          error: pipelineResult.error
        });

        return {
          userId: selectedUserId,
          status: "insufficient_content",
          providerMessageId: null,
          error: pipelineResult.error ?? null
        } satisfies CronPipelineResult;
      }

      if (pipelineResult.status === "send_failed") {
        logError("cron_generate_next", "send_failed", {
          route: CRON_ROUTE,
          run_at_utc: runAtUtc.toISOString(),
          user_id: selectedUserId,
          error: pipelineResult.error
        });

        return {
          userId: selectedUserId,
          status: "send_failed",
          providerMessageId: null,
          error: pipelineResult.error ?? null
        } satisfies CronPipelineResult;
      }

      logError("cron_generate_next", "pipeline_internal_error", {
        route: CRON_ROUTE,
        run_at_utc: runAtUtc.toISOString(),
        user_id: selectedUserId,
        error: pipelineResult.error
      });

      return {
        userId: selectedUserId,
        status: "internal_error",
        providerMessageId: null,
        error: pipelineResult.error ?? null
      } satisfies CronPipelineResult;
    });

    const counts = {
      sent: perUserResults.filter((result) => result.status === "sent").length,
      insufficient_content: perUserResults.filter((result) => result.status === "insufficient_content").length,
      send_failed: perUserResults.filter((result) => result.status === "send_failed").length,
      internal_error: perUserResults.filter((result) => result.status === "internal_error").length
    };

    return NextResponse.json({
      ok: true,
      status: "processed_batch",
      requested_batch_size: batchSize,
      claimed_user_count: selectedUserIds.length,
      counts,
      user_results: perUserResults.map((result) => ({
        user_id: result.userId,
        status: result.status,
        provider_message_id: result.providerMessageId
      }))
    });
  } catch (error) {
    logError("cron_generate_next", "error", { route: CRON_ROUTE, error });
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to select due user." },
      { status: 500 }
    );
  }
}
