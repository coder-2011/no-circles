import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { processedWebhooks, users } from "@/lib/db/schema";
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
