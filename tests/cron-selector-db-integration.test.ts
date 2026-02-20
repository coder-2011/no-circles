import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

function withPgTlsCompat(urlString: string): string {
  try {
    const url = new URL(urlString);
    const sslmode = url.searchParams.get("sslmode");
    const hasCompatFlag = url.searchParams.has("uselibpqcompat");

    if ((sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca") && !hasCompatFlag) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    return url.toString();
  } catch {
    return urlString;
  }
}

const describeDb = databaseUrl ? describe : describe.skip;

describeDb("claim_next_due_user db integration", () => {
  const pool = new Pool({ connectionString: withPgTlsCompat(databaseUrl as string) });
  const canonicalMemory =
    "PERSONALITY:\n- Test\n\nACTIVE_INTERESTS:\n- AI\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-";

  async function suppressPreexistingDueUsers(client: Awaited<ReturnType<Pool["connect"]>>, runAtUtc: string) {
    await client.query(
      `
      update public.users
      set last_issue_sent_at = $1::timestamptz
      where last_issue_sent_at is distinct from $1::timestamptz
      `,
      [runAtUtc]
    );
  }

  beforeAll(async () => {
    await pool.query("select 1");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("selects due users in deterministic order (null last_issue_sent_at first)", async () => {
    const client = await pool.connect();

    try {
      await client.query("begin");
      const runAt = "2026-02-16T16:00:00.000Z";
      await suppressPreexistingDueUsers(client, runAt);

      const firstInsert = await client.query<{ id: string }>(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
        values ($1, $2, $3, $4, $5, null)
        returning id
        `,
        [
          `cron-order-a-${Date.now()}@example.com`,
          "Order A",
          "UTC",
          "09:00",
          canonicalMemory
        ]
      );

      const secondInsert = await client.query<{ id: string }>(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
        values ($1, $2, $3, $4, $5, $6::timestamptz)
        returning id
        `,
        [
          `cron-order-b-${Date.now()}@example.com`,
          "Order B",
          "UTC",
          "09:00",
          canonicalMemory,
          "2026-02-15T10:00:00.000Z"
        ]
      );

      const firstPick = await client.query<{ selected_user_id: string | null }>(
        "select public.claim_next_due_user($1::timestamptz, 5) as selected_user_id",
        [runAt]
      );
      const secondPick = await client.query<{ selected_user_id: string | null }>(
        "select public.claim_next_due_user($1::timestamptz, 5) as selected_user_id",
        [runAt]
      );

      expect(firstPick.rows[0]?.selected_user_id).toBe(firstInsert.rows[0]?.id);
      expect(secondPick.rows[0]?.selected_user_id).toBe(secondInsert.rows[0]?.id);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("excludes users already sent today in their local timezone", async () => {
    const client = await pool.connect();

    try {
      await client.query("begin");
      const runAt = "2026-02-16T18:00:00.000Z";
      await suppressPreexistingDueUsers(client, runAt);

      await client.query(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
        values ($1, $2, $3, $4, $5, $6::timestamptz)
        `,
        [
          `cron-local-day-${Date.now()}@example.com`,
          "Local Day",
          "America/New_York",
          "09:00",
          canonicalMemory,
          "2026-02-16T14:30:00.000Z"
        ]
      );

      const pick = await client.query<{ selected_user_id: string | null }>(
        "select public.claim_next_due_user($1::timestamptz, 5) as selected_user_id",
        [runAt]
      );

      expect(pick.rows[0]?.selected_user_id).toBeNull();
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("enforces lease ttl before allowing same user re-selection", async () => {
    const client = await pool.connect();

    try {
      await client.query("begin");
      await suppressPreexistingDueUsers(client, "2026-02-16T10:00:00.000Z");

      const inserted = await client.query<{ id: string }>(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
        values ($1, $2, $3, $4, $5, null)
        returning id
        `,
        [
          `cron-lease-${Date.now()}@example.com`,
          "Lease",
          "UTC",
          "08:00",
          canonicalMemory
        ]
      );

      const first = await client.query<{ selected_user_id: string | null }>(
        "select public.claim_next_due_user($1::timestamptz, 5) as selected_user_id",
        ["2026-02-16T10:00:00.000Z"]
      );
      const secondWithinLease = await client.query<{ selected_user_id: string | null }>(
        "select public.claim_next_due_user($1::timestamptz, 5) as selected_user_id",
        ["2026-02-16T10:04:00.000Z"]
      );
      const thirdAfterLease = await client.query<{ selected_user_id: string | null }>(
        "select public.claim_next_due_user($1::timestamptz, 5) as selected_user_id",
        ["2026-02-16T10:06:00.000Z"]
      );

      expect(first.rows[0]?.selected_user_id).toBe(inserted.rows[0]?.id);
      expect(secondWithinLease.rows[0]?.selected_user_id).toBeNull();
      expect(thirdAfterLease.rows[0]?.selected_user_id).toBe(inserted.rows[0]?.id);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("claims multiple due users in deterministic order via claim_due_users_batch", async () => {
    const client = await pool.connect();

    try {
      await client.query("begin");
      const runAt = "2026-02-16T16:00:00.000Z";
      await suppressPreexistingDueUsers(client, runAt);

      const firstInsert = await client.query<{ id: string }>(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
        values ($1, $2, $3, $4, $5, null)
        returning id
        `,
        [
          `cron-batch-a-${Date.now()}@example.com`,
          "Batch A",
          "UTC",
          "09:00",
          canonicalMemory
        ]
      );

      const secondInsert = await client.query<{ id: string }>(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
        values ($1, $2, $3, $4, $5, null)
        returning id
        `,
        [
          `cron-batch-b-${Date.now()}@example.com`,
          "Batch B",
          "UTC",
          "09:00",
          canonicalMemory
        ]
      );

      const thirdInsert = await client.query<{ id: string }>(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
        values ($1, $2, $3, $4, $5, $6::timestamptz)
        returning id
        `,
        [
          `cron-batch-c-${Date.now()}@example.com`,
          "Batch C",
          "UTC",
          "09:00",
          canonicalMemory,
          "2026-02-15T10:00:00.000Z"
        ]
      );

      const batchClaim = await client.query<{ user_id: string }>(
        "select user_id from public.claim_due_users_batch($1::timestamptz, 5, 2)",
        [runAt]
      );

      expect(batchClaim.rows.map((row) => row.user_id)).toEqual([firstInsert.rows[0]?.id, secondInsert.rows[0]?.id]);

      const nextSingleClaim = await client.query<{ selected_user_id: string | null }>(
        "select public.claim_next_due_user($1::timestamptz, 5) as selected_user_id",
        [runAt]
      );
      expect(nextSingleClaim.rows[0]?.selected_user_id).toBe(thirdInsert.rows[0]?.id);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
