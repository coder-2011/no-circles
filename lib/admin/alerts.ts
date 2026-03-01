import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { adminAlertState } from "@/lib/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send-newsletter";
import type { ProviderSnapshot } from "@/lib/admin/provider-monitoring";

type AlertKind = "error" | "digest" | "threshold";

type ErrorAlertArgs = {
  subsystem: string;
  event: string;
  details?: Record<string, unknown>;
};

type SendAdminAlertArgs = {
  alertKey: string;
  kind: AlertKind;
  subject: string;
  text: string;
  html: string;
  payloadHash?: string | null;
  cooldownMinutes?: number;
};

const DEFAULT_DEDUPE_MINUTES = 30;

function isEnabled(): boolean {
  const raw = process.env.ADMIN_ALERTS_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }

  return Boolean(process.env.ADMIN_ALERT_EMAIL?.trim());
}

function getAdminEmail(): string | null {
  return process.env.ADMIN_ALERT_EMAIL?.trim() || null;
}

function getCooldownMinutes(argsCooldown?: number): number {
  if (typeof argsCooldown === "number" && Number.isFinite(argsCooldown) && argsCooldown >= 0) {
    return Math.floor(argsCooldown);
  }

  const envValue = Number(process.env.ADMIN_ALERT_DEDUPE_MINUTES?.trim() || `${DEFAULT_DEDUPE_MINUTES}`);
  return Number.isFinite(envValue) && envValue >= 0 ? Math.floor(envValue) : DEFAULT_DEDUPE_MINUTES;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function buildPayloadHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function claimAlertSlot(args: {
  alertKey: string;
  kind: AlertKind;
  payloadHash?: string | null;
  cooldownMinutes: number;
}): Promise<boolean> {
  const existingRows = await db.select().from(adminAlertState).where(eq(adminAlertState.alertKey, args.alertKey)).limit(1);
  const existing = existingRows[0] ?? null;
  const now = new Date();
  const cooldownMs = args.cooldownMinutes * 60 * 1000;

  if (existing) {
    const lastSentAtMs = existing.lastSentAt.getTime();
    const withinCooldown = now.getTime() - lastSentAtMs < cooldownMs;
    const samePayload = (existing.lastPayloadHash ?? null) === (args.payloadHash ?? null);

    if (withinCooldown && samePayload) {
      return false;
    }

    await db
      .update(adminAlertState)
      .set({
        kind: args.kind,
        lastSentAt: now,
        sendCount: existing.sendCount + 1,
        lastPayloadHash: args.payloadHash ?? null,
        updatedAt: now
      })
      .where(and(eq(adminAlertState.alertKey, args.alertKey), eq(adminAlertState.kind, existing.kind)));
    return true;
  }

  await db.insert(adminAlertState).values({
    alertKey: args.alertKey,
    kind: args.kind,
    lastSentAt: now,
    sendCount: 1,
    lastPayloadHash: args.payloadHash ?? null,
    createdAt: now,
    updatedAt: now
  });
  return true;
}

async function sendAdminEmail(args: SendAdminAlertArgs): Promise<void> {
  if (!isEnabled()) {
    return;
  }

  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    return;
  }

  const shouldSend = await claimAlertSlot({
    alertKey: args.alertKey,
    kind: args.kind,
    payloadHash: args.payloadHash ?? null,
    cooldownMinutes: getCooldownMinutes(args.cooldownMinutes)
  });

  if (!shouldSend) {
    return;
  }

  const result = await sendTransactionalEmail({
    to: adminEmail,
    subject: args.subject,
    html: args.html,
    text: args.text
  });

  if (!result.ok) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        subsystem: "admin_alert",
        event: "send_failed",
        alert_key: args.alertKey,
        error: result.error
      })
    );
  }
}

export async function notifyAdminOfError(args: ErrorAlertArgs): Promise<void> {
  if (!isEnabled()) {
    return;
  }

  if (args.subsystem === "admin_alert") {
    return;
  }

  const payload = {
    subsystem: args.subsystem,
    event: args.event,
    details: args.details ?? {}
  };
  const payloadHash = buildPayloadHash(payload);
  const subject = `[No Circles][Error] ${args.subsystem}:${args.event}`;
  const prettyJson = JSON.stringify(payload, null, 2);

  await sendAdminEmail({
    alertKey: `error:${args.subsystem}:${args.event}`,
    kind: "error",
    payloadHash,
    subject,
    text: [`A No Circles error event fired.`, "", prettyJson].join("\n"),
    html: [
      `<div style="font-family:Arial,sans-serif;color:#111;">`,
      `<h1 style="font-size:18px;margin:0 0 12px 0;">A No Circles error event fired</h1>`,
      `<p style="margin:0 0 8px 0;"><strong>Subsystem:</strong> ${escapeHtml(args.subsystem)}</p>`,
      `<p style="margin:0 0 12px 0;"><strong>Event:</strong> ${escapeHtml(args.event)}</p>`,
      `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(prettyJson)}</pre>`,
      `</div>`
    ].join("")
  });
}

export async function sendThresholdAlert(args: {
  provider: ProviderSnapshot["provider"];
  snapshot: ProviderSnapshot;
}): Promise<void> {
  if (args.snapshot.level !== "warn" && args.snapshot.level !== "error") {
    return;
  }

  const payload = {
    provider: args.provider,
    level: args.snapshot.level,
    summary: args.snapshot.summary,
    usageSummary: args.snapshot.usageSummary,
    costSummary: args.snapshot.costSummary,
    details: args.snapshot.details
  };

  await sendAdminEmail({
    alertKey: `threshold:${args.provider}`,
    kind: "threshold",
    payloadHash: buildPayloadHash(payload),
    subject: `[No Circles][Admin] ${args.provider} ${args.snapshot.level}`,
    text: [
      `${args.provider} monitoring triggered a ${args.snapshot.level} alert.`,
      "",
      args.snapshot.summary,
      args.snapshot.usageSummary ? `Usage: ${args.snapshot.usageSummary}` : null,
      args.snapshot.costSummary ? `Cost: ${args.snapshot.costSummary}` : null,
      ...args.snapshot.details.map((detail) => `- ${detail}`)
    ]
      .filter(Boolean)
      .join("\n"),
    html: [
      `<div style="font-family:Arial,sans-serif;color:#111;">`,
      `<h1 style="font-size:18px;margin:0 0 12px 0;">${escapeHtml(args.provider)} ${escapeHtml(args.snapshot.level)} alert</h1>`,
      `<p style="margin:0 0 12px 0;">${escapeHtml(args.snapshot.summary)}</p>`,
      args.snapshot.usageSummary
        ? `<p style="margin:0 0 8px 0;"><strong>Usage:</strong> ${escapeHtml(args.snapshot.usageSummary)}</p>`
        : "",
      args.snapshot.costSummary
        ? `<p style="margin:0 0 8px 0;"><strong>Cost:</strong> ${escapeHtml(args.snapshot.costSummary)}</p>`
        : "",
      `<ul>${args.snapshot.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`,
      `</div>`
    ].join("")
  });
}

export async function sendDailyDigest(args: {
  digestKey: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  await sendAdminEmail({
    alertKey: `digest:${args.digestKey}`,
    kind: "digest",
    payloadHash: args.digestKey,
    cooldownMinutes: 24 * 60,
    subject: args.subject,
    text: args.text,
    html: args.html
  });
}
