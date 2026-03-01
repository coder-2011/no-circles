import { eq, sql } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db/client";
import { outboundSendIdempotency } from "@/lib/db/schema";

export type OutboundSendStatus = "processing" | "sent" | "failed";
export type NewsletterIssueVariant = "daily" | "welcome";
const STALE_PROCESSING_RECLAIM_MINUTES = 15;

export type ReserveOutboundSendResult = {
  outcome:
    | "claimed"
    | "retryable_failed_claimed"
    | "stale_processing_claimed"
    | "already_sent"
    | "already_processing";
  status: OutboundSendStatus;
  providerMessageId: string | null;
};

export function buildOutboundIdempotencyKey(args: {
  userId: string;
  timezone: string;
  runAtUtc: Date;
  issueVariant?: NewsletterIssueVariant;
}): { idempotencyKey: string; localIssueDate: string } {
  const localIssueDate = formatInTimeZone(args.runAtUtc, args.timezone, "yyyy-MM-dd");
  const issueVariant = args.issueVariant ?? "daily";
  return {
    idempotencyKey: `newsletter:v1:${issueVariant}:${args.userId}:${localIssueDate}`,
    localIssueDate
  };
}

export async function reserveOutboundSendIdempotency(args: {
  userId: string;
  idempotencyKey: string;
  localIssueDate: string;
  issueVariant: NewsletterIssueVariant;
}): Promise<ReserveOutboundSendResult> {
  const result = await db.execute<{
    outcome: string;
    status: string;
    provider_message_id: string | null;
  }>(sql`
    with inserted as (
      insert into "outbound_send_idempotency" (
        "user_id",
        "idempotency_key",
        "local_issue_date",
        "issue_variant",
        "status"
      )
      values (
        ${args.userId}::uuid,
        ${args.idempotencyKey},
        ${args.localIssueDate}::date,
        ${args.issueVariant},
        'processing'
      )
      on conflict ("idempotency_key") do nothing
      returning
        'claimed'::text as outcome,
        "status"::text as status,
        "provider_message_id"::text as provider_message_id,
        1 as priority
    ),
    reclaimed as (
      update "outbound_send_idempotency"
      set
        "status" = 'processing',
        "provider_message_id" = null,
        "failure_reason" = null,
        "updated_at" = now()
      where
        "idempotency_key" = ${args.idempotencyKey}
        and "status" = 'failed'
      returning
        'retryable_failed_claimed'::text as outcome,
        "status"::text as status,
        "provider_message_id"::text as provider_message_id,
        2 as priority
    ),
    stale_reclaimed as (
      update "outbound_send_idempotency"
      set
        "status" = 'processing',
        "provider_message_id" = null,
        "failure_reason" = null,
        "updated_at" = now()
      where
        "idempotency_key" = ${args.idempotencyKey}
        and "status" = 'processing'
        and "updated_at" < now() - (${STALE_PROCESSING_RECLAIM_MINUTES}::text || ' minutes')::interval
      returning
        'stale_processing_claimed'::text as outcome,
        "status"::text as status,
        "provider_message_id"::text as provider_message_id,
        3 as priority
    ),
    existing as (
      select
        case
          when "status" = 'sent' then 'already_sent'::text
          else 'already_processing'::text
        end as outcome,
        "status"::text as status,
        "provider_message_id"::text as provider_message_id,
        4 as priority
      from "outbound_send_idempotency"
      where "idempotency_key" = ${args.idempotencyKey}
    )
    select "outcome", "status", "provider_message_id"
    from (
      select * from inserted
      union all
      select * from reclaimed
      union all
      select * from stale_reclaimed
      union all
      select * from existing
    ) as ranked
    order by "priority"
    limit 1
  `);

  const row = result.rows[0];
  if (!row) {
    throw new Error("IDEMPOTENCY_RESERVE_EMPTY_RESULT");
  }

  const status = row.status;
  if (status !== "processing" && status !== "sent" && status !== "failed") {
    throw new Error(`IDEMPOTENCY_RESERVE_INVALID_STATUS:${status}`);
  }

  const outcome = row.outcome;
  if (
    outcome !== "claimed" &&
    outcome !== "retryable_failed_claimed" &&
    outcome !== "stale_processing_claimed" &&
    outcome !== "already_sent" &&
    outcome !== "already_processing"
  ) {
    throw new Error(`IDEMPOTENCY_RESERVE_INVALID_OUTCOME:${outcome}`);
  }

  return {
    outcome,
    status,
    providerMessageId: row.provider_message_id ?? null
  };
}

export async function markOutboundSendIdempotencySent(args: {
  idempotencyKey: string;
  providerMessageId?: string | null;
}): Promise<void> {
  await db
    .update(outboundSendIdempotency)
    .set({
      status: "sent",
      providerMessageId: args.providerMessageId ?? null,
      failureReason: null,
      updatedAt: new Date()
    })
    .where(eq(outboundSendIdempotency.idempotencyKey, args.idempotencyKey));
}

export async function markOutboundSendIdempotencyFailed(args: {
  idempotencyKey: string;
  reason: string;
}): Promise<void> {
  await db
    .update(outboundSendIdempotency)
    .set({
      status: "failed",
      failureReason: args.reason,
      updatedAt: new Date()
    })
    .where(eq(outboundSendIdempotency.idempotencyKey, args.idempotencyKey));
}

export async function getOutboundSendIdempotency(args: {
  idempotencyKey: string;
}): Promise<{ status: OutboundSendStatus; providerMessageId: string | null } | null> {
  const rows = await db
    .select({
      status: outboundSendIdempotency.status,
      providerMessageId: outboundSendIdempotency.providerMessageId
    })
    .from(outboundSendIdempotency)
    .where(eq(outboundSendIdempotency.idempotencyKey, args.idempotencyKey))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const status = rows[0].status;
  if (status !== "processing" && status !== "sent" && status !== "failed") {
    return null;
  }

  return {
    status,
    providerMessageId: rows[0].providerMessageId
  };
}
