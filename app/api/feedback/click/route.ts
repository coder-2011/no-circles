import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { appendRecentFeedbackLines } from "@/lib/memory/processors";
import { logError, logInfo, logWarn } from "@/lib/observability/log";
import { reserveWebhookEvent } from "@/lib/webhooks/inbound-idempotency";
import { verifyFeedbackClickToken } from "@/lib/feedback/click-token";

const FEEDBACK_PROVIDER = "feedback_click";
const ROUTE = "GET /api/feedback/click";

function renderHtml(message: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    "<title>No-Circles Feedback</title>",
    "</head>",
    '<body style="font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; background: #F6F1E3; color: #2D3426; margin: 0;">',
    '<main style="max-width: 560px; margin: 48px auto; background: #FBF7EB; border: 1px solid #D8CFB4; border-radius: 14px; padding: 22px;">',
    '<h1 style="margin: 0 0 10px; font-size: 22px;">No-Circles</h1>',
    `<p style="margin: 0; line-height: 1.55;">${message}</p>`,
    "</main>",
    "</body>",
    "</html>"
  ].join("\n");
}

function htmlResponse(message: string, status = 200): Response {
  return new NextResponse(renderHtml(message), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function feedbackLine(args: { feedbackType: "more_like_this" | "less_like_this"; url: string; title: string }): string {
  const marker = args.feedbackType === "more_like_this" ? "+" : "-";
  return `${marker} ${args.title} | ${args.url}`;
}

export async function GET(request: Request) {
  const secret = process.env.FEEDBACK_LINK_SECRET?.trim();
  if (!secret) {
    logError("feedback_click", "missing_secret", { route: ROUTE });
    return htmlResponse("This feedback link is not configured yet.", 500);
  }

  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    logWarn("feedback_click", "missing_token", { route: ROUTE });
    return htmlResponse("Invalid feedback link.", 400);
  }

  const verified = verifyFeedbackClickToken({ token, secret });
  if (!verified.ok) {
    logWarn("feedback_click", "invalid_token", {
      route: ROUTE,
      reason: verified.reason
    });
    return htmlResponse("This feedback link is invalid or expired.", 400);
  }

  const payload = verified.payload;
  const reserved = await reserveWebhookEvent(FEEDBACK_PROVIDER, payload.jti);
  if (!reserved) {
    logInfo("feedback_click", "duplicate_ignored", {
      route: ROUTE,
      user_id: payload.uid,
      jti: payload.jti,
      feedback_type: payload.ft
    });
    return htmlResponse("Feedback already recorded. Thank you.");
  }

  try {
    const line = feedbackLine({
      feedbackType: payload.ft,
      url: payload.url,
      title: payload.title
    });

    const updated = await db.transaction(async (tx) => {
      const lockedRows = await tx.execute<{ id: string; interest_memory_text: string }>(
        sql`select id, interest_memory_text from users where id = ${payload.uid} for update`
      );

      const user = lockedRows.rows[0];
      if (!user) {
        return null;
      }

      const nextMemory = appendRecentFeedbackLines(user.interest_memory_text, [line]);
      await tx
        .update(users)
        .set({ interestMemoryText: nextMemory })
        .where(eq(users.id, payload.uid));

      return nextMemory;
    });

    if (!updated) {
      logWarn("feedback_click", "user_not_found", {
        route: ROUTE,
        user_id: payload.uid,
        jti: payload.jti
      });
      return htmlResponse("We could not apply this feedback because the account was not found.", 404);
    }

    logInfo("feedback_click", "recorded", {
      route: ROUTE,
      user_id: payload.uid,
      feedback_type: payload.ft,
      jti: payload.jti
    });

    const thanksMessage = payload.ft === "more_like_this"
      ? "Got it. We will include more content like this."
      : "Got it. We will include less content like this.";

    return htmlResponse(thanksMessage);
  } catch (error) {
    logError("feedback_click", "processing_failed", {
      route: ROUTE,
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      user_id: payload.uid,
      jti: payload.jti
    });

    return htmlResponse("Feedback could not be saved right now. Please try again later.", 500);
  }
}
