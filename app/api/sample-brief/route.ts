import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { outboundSendIdempotency, users } from "@/lib/db/schema";
import { logError, logWarn } from "@/lib/observability/log";
import { parseNewsletterText } from "@/lib/sample-brief/parse-newsletter-text";

const ROUTE = "GET /api/sample-brief";
const SAMPLE_SOURCE_EMAIL_CANDIDATES = [
  "naman.chetwani@gmail.com",
  "naman.chatwani@gmail.com",
  "naman.chitwani@gmail.com"
] as const;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MISSING_RESEND_API_KEY");
  }

  return new Resend(apiKey);
}

export async function GET() {
  try {
    const userRows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, [...SAMPLE_SOURCE_EMAIL_CANDIDATES]));

    const candidateOrder = new Map<string, number>(SAMPLE_SOURCE_EMAIL_CANDIDATES.map((email, index) => [email, index]));
    const user = [...userRows].sort((a, b) => {
      const left = candidateOrder.get(a.email) ?? Number.MAX_SAFE_INTEGER;
      const right = candidateOrder.get(b.email) ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    if (!user) {
      return NextResponse.json(
        { ok: false, error_code: "SOURCE_USER_NOT_FOUND", message: "Sample source user not found." },
        { status: 404 }
      );
    }

    const latestRows = await db
      .select({
        providerMessageId: outboundSendIdempotency.providerMessageId,
        localIssueDate: outboundSendIdempotency.localIssueDate
      })
      .from(outboundSendIdempotency)
      .where(
        and(
          eq(outboundSendIdempotency.userId, user.id),
          eq(outboundSendIdempotency.issueVariant, "daily"),
          eq(outboundSendIdempotency.status, "sent"),
          isNotNull(outboundSendIdempotency.providerMessageId)
        )
      )
      .orderBy(desc(outboundSendIdempotency.updatedAt))
      .limit(1);

    const latest = latestRows[0];
    if (!latest?.providerMessageId) {
      return NextResponse.json(
        { ok: false, error_code: "SOURCE_BRIEF_NOT_FOUND", message: "No sent brief available for source user." },
        { status: 404 }
      );
    }

    const resend = getResendClient();
    const messageResponse = await resend.emails.get(latest.providerMessageId);

    if (messageResponse.error) {
      logWarn("sample_brief", "provider_fetch_failed", {
        route: ROUTE,
        provider_message_id: latest.providerMessageId,
        error: messageResponse.error.message
      });

      return NextResponse.json(
        { ok: false, error_code: "PROVIDER_FETCH_FAILED", message: "Failed to fetch source brief from provider." },
        { status: 502 }
      );
    }

    const messageText = messageResponse.data?.text ?? "";
    const parsed = parseNewsletterText(messageText);

    if (parsed.items.length === 0) {
      return NextResponse.json(
        { ok: false, error_code: "SOURCE_BRIEF_PARSE_FAILED", message: "Could not parse source brief content." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      source_email: user.email,
      local_issue_date: latest.localIssueDate,
      provider_message_id: latest.providerMessageId,
      items: parsed.items,
      quote: parsed.quote
    });
  } catch (error) {
    logError("sample_brief", "error", { route: ROUTE, error });
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to load sample brief." },
      { status: 500 }
    );
  }
}
