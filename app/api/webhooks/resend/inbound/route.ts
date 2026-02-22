import { desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { outboundSendIdempotency, processedWebhooks, users } from "@/lib/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send-newsletter";
import { mergeReplyIntoMemory } from "@/lib/memory/processors";
import { logError, logInfo, logWarn } from "@/lib/observability/log";
import { resendInboundWebhookSchema } from "@/lib/schemas";
import { getSvixHeaders, verifyResendWebhookSignature } from "@/lib/webhooks/resend-signature";

const PROVIDER = "resend";
const INBOUND_ROUTE = "POST /api/webhooks/resend/inbound";
const MAX_INBOUND_PAYLOAD_BYTES = 16 * 1024;

function isJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  return typeof contentType === "string" && contentType.toLowerCase().includes("application/json");
}

function payloadBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function extractSenderEmail(fromField: string): string | null {
  const match = fromField.match(/<([^>]+)>/);
  const candidate = (match?.[1] ?? fromField).trim().toLowerCase();

  return candidate.includes("@") ? candidate : null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function extractTopReplyFromHtml(html: string | null | undefined): string | null {
  const source = toNonEmptyString(html);
  if (!source) {
    return null;
  }

  const firstAutoBlock = source.match(/<div[^>]*dir=["']auto["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!firstAutoBlock) {
    return null;
  }

  const text = toNonEmptyString(decodeHtmlEntities(stripHtmlTags(firstAutoBlock[1] ?? "")));
  return text;
}

function extractNewestReplyText(rawText: string | null | undefined): string | null {
  const raw = toNonEmptyString(rawText);
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/\r\n?/g, "\n")
    // Gmail plain text can concatenate "...ai stuffOn Sun, Feb..." with no newline.
    .replace(/([a-z0-9])On ([A-Z][a-z]{2},)/g, "$1\nOn $2");

  const lines = normalized.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") {
        kept.push("");
      }
      continue;
    }

    const lower = trimmed.toLowerCase();
    if (
      /^on .+ wrote:$/i.test(trimmed) ||
      trimmed.startsWith(">") ||
      lower.startsWith("from:") ||
      lower.startsWith("subject:") ||
      lower.startsWith("to:") ||
      lower.startsWith("sent:") ||
      lower.includes("original message")
    ) {
      break;
    }

    kept.push(trimmed);
  }

  return toNonEmptyString(kept.join("\n").replace(/\n{3,}/g, "\n\n"));
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MISSING_RESEND_API_KEY");
  }

  return new Resend(apiKey);
}

async function fetchInboundReplyText(emailId: string): Promise<string | null> {
  const resend = getResendClient();

  const receivingResponse = await resend.emails.receiving.get(emailId);
  if (receivingResponse.error) {
    throw new Error(receivingResponse.error.message || "RESEND_RECEIVING_GET_ERROR");
  }

  const replyFromHtml = extractTopReplyFromHtml(receivingResponse.data?.html);
  const replyFromReceivingText = extractNewestReplyText(receivingResponse.data?.text);

  if (replyFromHtml) {
    return replyFromHtml;
  }

  if (replyFromReceivingText) {
    return replyFromReceivingText;
  }

  const emailResponse = await resend.emails.get(emailId);
  if (emailResponse.error) {
    throw new Error(emailResponse.error.message || "RESEND_EMAIL_GET_ERROR");
  }

  return extractNewestReplyText(emailResponse.data?.text);
}

function resolveMessageId(payload: (typeof resendInboundWebhookSchema)["_output"]): string | null {
  const data = payload.data;
  const headerMessageId = toNonEmptyString(data.headers?.["message-id"]);

  return (
    toNonEmptyString(data.email_id) ??
    toNonEmptyString(data.message_id) ??
    toNonEmptyString(data.id) ??
    headerMessageId
  );
}

function getHeaderCaseInsensitive(headers: Record<string, string> | undefined, key: string): string | null {
  if (!headers) {
    return null;
  }

  const lookup = key.toLowerCase();
  for (const [headerKey, value] of Object.entries(headers)) {
    if (headerKey.toLowerCase() !== lookup) {
      continue;
    }

    const normalized = toNonEmptyString(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeMessageToken(value: string): string {
  return value.replace(/[<>]/g, "").trim();
}

function collectThreadMessageIds(headers: Record<string, string> | undefined): string[] {
  const inReplyTo = getHeaderCaseInsensitive(headers, "in-reply-to");
  const references = getHeaderCaseInsensitive(headers, "references");

  const values = [inReplyTo, references].filter((value): value is string => Boolean(value));
  const tokens = values
    .flatMap((value) => value.split(/\s+/))
    .map((token) => normalizeMessageToken(token))
    .filter((token) => token.length > 0);

  return [...new Set(tokens)];
}

async function resolveSubscribedEmailForThread(headers: Record<string, string> | undefined): Promise<string | null> {
  const threadMessageIds = collectThreadMessageIds(headers);
  if (threadMessageIds.length === 0) {
    return null;
  }

  const rows = await db
    .select({
      email: users.email
    })
    .from(outboundSendIdempotency)
    .innerJoin(users, eq(outboundSendIdempotency.userId, users.id))
    .where(inArray(outboundSendIdempotency.providerMessageId, threadMessageIds))
    .orderBy(desc(outboundSendIdempotency.updatedAt))
    .limit(1);

  return rows[0]?.email ?? null;
}

async function sendWrongAccountAutoReply(args: { to: string; subscribedEmail: string | null }) {
  const subscribedLine = args.subscribedEmail
    ? `Please reply from your subscribed email address: ${args.subscribedEmail}.`
    : "Please reply from the same email address you used to sign up for No Circles.";

  const text = [
    "We got your reply, but it came from an email address that is not linked to your No Circles account.",
    subscribedLine,
    "If this was intentional, update your account email first and then reply again."
  ].join("\n\n");

  const html = [
    "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;\">",
    "<h2 style=\"margin-top: 0;\">Reply From Your Subscribed Email</h2>",
    "<p style=\"line-height: 1.5;\">We got your reply, but it came from an email address that is not linked to your No Circles account.</p>",
    `<p style=\"line-height: 1.5;\">${subscribedLine}</p>`,
    "<p style=\"line-height: 1.5; color: #555;\">If this was intentional, update your account email first and then reply again.</p>",
    "</div>"
  ].join("\n");

  await sendTransactionalEmail({
    to: args.to,
    subject: "Use your subscribed email to update No Circles",
    html,
    text
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logError("webhook_inbound", "missing_webhook_secret", { route: INBOUND_ROUTE });
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Missing webhook secret configuration." },
      { status: 500 }
    );
  }

  if (!isJsonContentType(request)) {
    logWarn("webhook_inbound", "unsupported_media_type", { route: INBOUND_ROUTE });
    return NextResponse.json(
      { ok: false, error_code: "UNSUPPORTED_MEDIA_TYPE", message: "Expected application/json." },
      { status: 415 }
    );
  }

  const signatureHeaders = getSvixHeaders(request);
  if (!signatureHeaders) {
    logWarn("webhook_inbound", "missing_signature_headers", { route: INBOUND_ROUTE });
    return NextResponse.json(
      { ok: false, error_code: "INVALID_SIGNATURE", message: "Missing webhook signature headers." },
      { status: 401 }
    );
  }

  const rawBody = await request.text();
  if (payloadBytes(rawBody) > MAX_INBOUND_PAYLOAD_BYTES) {
    logWarn("webhook_inbound", "payload_too_large", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId
    });
    return NextResponse.json(
      { ok: false, error_code: "PAYLOAD_TOO_LARGE", message: "Inbound payload exceeds size limit." },
      { status: 413 }
    );
  }

  if (!verifyResendWebhookSignature(rawBody, signatureHeaders, webhookSecret)) {
    logWarn("webhook_inbound", "invalid_signature", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId
    });
    return NextResponse.json(
      { ok: false, error_code: "INVALID_SIGNATURE", message: "Invalid webhook signature." },
      { status: 401 }
    );
  }

  const parsedJson = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return null;
    }
  })();

  if (!parsedJson) {
    logWarn("webhook_inbound", "invalid_payload_json", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId
    });
    return NextResponse.json(
      { ok: false, error_code: "INVALID_PAYLOAD", message: "Invalid inbound payload." },
      { status: 400 }
    );
  }

  const parsedPayload = resendInboundWebhookSchema.safeParse(parsedJson);
  if (!parsedPayload.success) {
    logWarn("webhook_inbound", "invalid_payload_schema", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId
    });
    return NextResponse.json(
      { ok: false, error_code: "INVALID_PAYLOAD", message: "Invalid inbound payload." },
      { status: 400 }
    );
  }

  const senderEmail = extractSenderEmail(parsedPayload.data.data.from);
  if (!senderEmail) {
    logInfo("webhook_inbound", "ignored_invalid_sender", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId
    });
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const inlineReplyText = parsedPayload.data.data.text.trim();
  const replyEmailId = toNonEmptyString(parsedPayload.data.data.email_id);

  let inboundReplyText = inlineReplyText;
  if (!inboundReplyText && replyEmailId) {
    try {
      inboundReplyText = (await fetchInboundReplyText(replyEmailId)) ?? "";
    } catch (error) {
      logError("webhook_inbound", "email_content_fetch_failed", {
        route: INBOUND_ROUTE,
        svix_id: signatureHeaders.svixId,
        email_id: replyEmailId,
        error
      });
      return NextResponse.json(
        { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to fetch inbound email content." },
        { status: 500 }
      );
    }
  }

  if (!inboundReplyText) {
    logInfo("webhook_inbound", "ignored_empty_text", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId,
      sender_email: senderEmail,
      email_id_present: Boolean(replyEmailId)
    });
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  try {
    const [user] = await db
      .select({ id: users.id, interestMemoryText: users.interestMemoryText })
      .from(users)
      .where(sql`lower(${users.email}) = ${senderEmail}`)
      .limit(1);

    if (!user) {
      const subscribedEmail = await resolveSubscribedEmailForThread(parsedPayload.data.data.headers).catch(() => null);
      await sendWrongAccountAutoReply({ to: senderEmail, subscribedEmail }).catch(() => undefined);
      logInfo("webhook_inbound", "ignored_unknown_sender", {
        route: INBOUND_ROUTE,
        svix_id: signatureHeaders.svixId,
        sender_email: senderEmail
      });
      return NextResponse.json({ ok: true, status: "ignored" });
    }

    const dedupeKey = (() => {
      const messageId = resolveMessageId(parsedPayload.data);
      if (messageId) {
        return `message:${messageId}`;
      }

      return `event:${signatureHeaders.svixId}`;
    })();

    const status = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(processedWebhooks)
        .values({ provider: PROVIDER, webhookId: dedupeKey })
        .onConflictDoNothing({ target: [processedWebhooks.provider, processedWebhooks.webhookId] })
        .returning({ id: processedWebhooks.id });

      if (inserted.length === 0) {
        return "ignored" as const;
      }

      const updatedMemory = await mergeReplyIntoMemory(user.interestMemoryText, inboundReplyText);

      await tx
        .update(users)
        .set({ interestMemoryText: updatedMemory })
        .where(eq(users.id, user.id));

      return "updated" as const;
    });

    if (status === "ignored") {
      logInfo("webhook_inbound", "ignored_replay", {
        route: INBOUND_ROUTE,
        svix_id: signatureHeaders.svixId,
        user_id: user.id,
        dedupe_key: dedupeKey
      });
      return NextResponse.json({ ok: true, status: "ignored" });
    }

    logInfo("webhook_inbound", "updated", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId,
      user_id: user.id
    });
    return NextResponse.json({ ok: true, status: "updated", user_id: user.id });
  } catch (error) {
    logError("webhook_inbound", "error", {
      route: INBOUND_ROUTE,
      svix_id: signatureHeaders.svixId,
      error
    });
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to process inbound webhook." },
      { status: 500 }
    );
  }
}

export async function GET() {
  logWarn("webhook_inbound", "method_not_allowed", { route: INBOUND_ROUTE, method: "GET" });
  return NextResponse.json(
    { ok: false, error_code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
    { status: 405 }
  );
}
