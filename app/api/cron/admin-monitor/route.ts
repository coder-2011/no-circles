import { NextResponse } from "next/server";
import { sendDailyDigest, sendThresholdAlert } from "@/lib/admin/alerts";
import { buildDailyDigestContent, collectProviderSnapshots } from "@/lib/admin/provider-monitoring";
import { logError, logInfo, logWarn } from "@/lib/observability/log";

const ROUTE = "POST /api/cron/admin-monitor";

function getCronSecret(): string | null {
  return process.env.ADMIN_MONITOR_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || null;
}

function authorizeRequest(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorizeRequest(request)) {
    logWarn("admin_monitor", "unauthorized", { route: ROUTE });
    return NextResponse.json(
      { ok: false, error_code: "UNAUTHORIZED", message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const runAt = new Date();
    const snapshots = await collectProviderSnapshots(runAt);

    for (const snapshot of snapshots) {
      if (snapshot.level === "error") {
        logError("admin_monitor", "provider_check_failed", {
          route: ROUTE,
          provider: snapshot.provider,
          details: snapshot.details,
          summary: snapshot.summary
        });
      }

      if (snapshot.level === "warn" || snapshot.level === "error") {
        await sendThresholdAlert({
          provider: snapshot.provider,
          snapshot
        });
      }
    }

    const digest = buildDailyDigestContent({
      runAt,
      snapshots
    });

    await sendDailyDigest({
      digestKey: runAt.toISOString().slice(0, 10),
      subject: digest.subject,
      text: digest.text,
      html: digest.html
    });

    logInfo("admin_monitor", "digest_processed", {
      route: ROUTE,
      run_at_utc: runAt.toISOString(),
      provider_statuses: snapshots.map((snapshot) => ({
        provider: snapshot.provider,
        level: snapshot.level
      }))
    });

    return NextResponse.json({
      ok: true,
      run_at_utc: runAt.toISOString(),
      provider_statuses: snapshots.map((snapshot) => ({
        provider: snapshot.provider,
        level: snapshot.level,
        summary: snapshot.summary
      }))
    });
  } catch (error) {
    logError("admin_monitor", "digest_failed", { route: ROUTE, error });
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to process admin monitor." },
      { status: 500 }
    );
  }
}

export async function GET() {
  logWarn("admin_monitor", "method_not_allowed", { route: ROUTE, method: "GET" });
  return NextResponse.json(
    { ok: false, error_code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
    { status: 405 }
  );
}
