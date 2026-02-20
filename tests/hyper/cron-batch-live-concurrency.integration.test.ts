import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const describeLive = databaseUrl ? describe : describe.skip;

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

function toLocalSendTime(runAtUtcIso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(runAtUtcIso));

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

describeLive("hyper integration: cron batch live concurrency", () => {
  const pool = new Pool({ connectionString: withPgTlsCompat(databaseUrl as string) });

  beforeAll(async () => {
    await pool.query("select 1");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("claims 3 unique users concurrently at run_at_utc=now+1 minute across mixed timezones", async () => {
    const runAtUtc = new Date(Date.now() + 60_000);
    runAtUtc.setSeconds(0, 0);
    const runAtUtcIso = runAtUtc.toISOString();

    const zones = ["UTC", "America/New_York", "Asia/Tokyo"] as const;
    const prefix = `hyper-cron-concurrency-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const canonicalMemory =
      "PERSONALITY:\n- Test\n\nACTIVE_INTERESTS:\n- AI\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-";

    const seededUserIds: string[] = [];

    try {
      for (let i = 0; i < zones.length; i += 1) {
        const timezone = zones[i] as (typeof zones)[number];
        const sendTimeLocal = toLocalSendTime(runAtUtcIso, timezone);
        const email = `${prefix}-${i + 1}@example.com`;

        const inserted = await pool.query<{ id: string }>(
          `
          insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at)
          values ($1, $2, $3, $4::time, $5, null)
          returning id
          `,
          [email, `Cron Hyper ${i + 1}`, timezone, sendTimeLocal, canonicalMemory]
        );

        const seededUserId = inserted.rows[0]?.id;
        expect(seededUserId).toBeTruthy();
        seededUserIds.push(seededUserId as string);
      }

      const worker = async () => {
        const result = await pool.query<{ user_id: string | null }>(
          `
          select user_id
          from public.claim_due_users_batch($1::timestamptz, 5, 1)
          `,
          [runAtUtcIso]
        );

        return result.rows[0]?.user_id ?? null;
      };

      const claims = await Promise.all([worker(), worker(), worker()]);
      const nonNullClaims = claims.filter((value): value is string => Boolean(value));
      const uniqueClaims = new Set(nonNullClaims);
      const seededClaimHits = nonNullClaims.filter((id) => seededUserIds.includes(id));

      expect(nonNullClaims).toHaveLength(3);
      expect(uniqueClaims.size).toBe(3);
      expect(seededClaimHits.length).toBeGreaterThan(0);
    } finally {
      await pool.query(`delete from public.users where email like $1`, [`${prefix}-%@example.com`]);
    }
  }, 120000);
});
