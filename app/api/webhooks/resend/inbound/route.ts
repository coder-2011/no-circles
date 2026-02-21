import { desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { outboundSendIdempotency, processedWebhooks, users } from "@/lib/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send-newsletter";
import { mergeReplyIntoMemory } from "@/lib/memory/processors";
import { resendInboundWebhookSchema } from "@/lib/schemas";
import { getSvixHeaders, verifyResendWebhookSignature } from "@/lib/webhooks/resend-signature";

const PROVIDER = "resend";

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
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Missing webhook secret configuration." },
      { status: 500 }
    );
  }

  const signatureHeaders = getSvixHeaders(request);
  if (!signatureHeaders) {
    return NextResponse.json(
      { ok: false, error_code: "INVALID_SIGNATURE", message: "Missing webhook signature headers." },
      { status: 401 }
    );
  }

  const rawBody = await request.text();

  if (!verifyResendWebhookSignature(rawBody, signatureHeaders, webhookSecret)) {
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
    return NextResponse.json(
      { ok: false, error_code: "INVALID_PAYLOAD", message: "Invalid inbound payload." },
      { status: 400 }
    );
  }

  const parsedPayload = resendInboundWebhookSchema.safeParse(parsedJson);
  if (!parsedPayload.success) {
    return NextResponse.json(
      { ok: false, error_code: "INVALID_PAYLOAD", message: "Invalid inbound payload." },
      { status: 400 }
    );
  }

  const senderEmail = extractSenderEmail(parsedPayload.data.data.from);
  if (!senderEmail) {
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const inboundReplyText = parsedPayload.data.data.text.trim();
  if (!inboundReplyText) {
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
      return NextResponse.json({ ok: true, status: "ignored" });
    }

    return NextResponse.json({ ok: true, status: "updated", user_id: user.id });
  } catch {
    return NextResponse.json(
      { ok: false, error_code: "INTERNAL_ERROR", message: "Failed to process inbound webhook." },
      { status: 500 }
    );
  }
}
