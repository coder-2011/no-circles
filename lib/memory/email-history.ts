import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const RECENT_EMAIL_HISTORY_LIMIT = 5;

export type UserEmailHistoryKind = "sent" | "reply";

export type RecentEmailRecord = {
  createdAt: string;
  subject: string | null;
  bodyText: string;
  providerMessageId: string | null;
  issueVariant: string | null;
};

type SqlExecutor = Pick<typeof db, "execute">;

function normalizeSubject(subject: string | null | undefined): string | null {
  if (typeof subject !== "string") {
    return null;
  }

  const trimmed = subject.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBodyText(bodyText: string): string {
  return bodyText.replace(/\r\n?/g, "\n").trim();
}

export async function recordRecentEmailHistory(
  args: {
    userId: string;
    kind: UserEmailHistoryKind;
    bodyText: string;
    subject?: string | null;
    providerMessageId?: string | null;
    issueVariant?: string | null;
  },
  executor: SqlExecutor = db
): Promise<void> {
  const bodyText = normalizeBodyText(args.bodyText);
  if (!bodyText) {
    return;
  }

  await executor.execute(sql`
    insert into "user_email_history" (
      "user_id",
      "kind",
      "subject",
      "body_text",
      "provider_message_id",
      "issue_variant"
    ) values (
      ${args.userId},
      ${args.kind},
      ${normalizeSubject(args.subject)},
      ${bodyText},
      ${args.providerMessageId ?? null},
      ${args.issueVariant ?? null}
    )
  `);

  await executor.execute(sql`
    delete from "user_email_history"
    where "id" in (
      select "id"
      from (
        select
          "id",
          row_number() over (
            partition by "user_id", "kind"
            order by "created_at" desc, "id" desc
          ) as "row_number"
        from "user_email_history"
        where "user_id" = ${args.userId}
          and "kind" = ${args.kind}
      ) as "ranked_history"
      where "row_number" > ${RECENT_EMAIL_HISTORY_LIMIT}
    )
  `);
}

async function loadRecentEmailHistoryByKind(
  userId: string,
  kind: UserEmailHistoryKind
): Promise<RecentEmailRecord[]> {
  const result = await db.execute<{
    created_at: Date | string;
    subject: string | null;
    body_text: string;
    provider_message_id: string | null;
    issue_variant: string | null;
  }>(sql`
    select
      "created_at",
      "subject",
      "body_text",
      "provider_message_id",
      "issue_variant"
    from "user_email_history"
    where "user_id" = ${userId}
      and "kind" = ${kind}
    order by "created_at" desc, "id" desc
    limit ${RECENT_EMAIL_HISTORY_LIMIT}
  `);

  return result.rows.map((row) => ({
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    subject: row.subject ?? null,
    bodyText: row.body_text,
    providerMessageId: row.provider_message_id ?? null,
    issueVariant: row.issue_variant ?? null
  }));
}

export async function loadRecentEmailHistory(userId: string): Promise<{
  recentSentEmails: RecentEmailRecord[];
  recentReplyEmails: RecentEmailRecord[];
}> {
  const [recentSentEmails, recentReplyEmails] = await Promise.all([
    loadRecentEmailHistoryByKind(userId, "sent"),
    loadRecentEmailHistoryByKind(userId, "reply")
  ]);

  return {
    recentSentEmails,
    recentReplyEmails
  };
}
