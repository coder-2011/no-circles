import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

const { resendSendMock } = vi.hoisted(() => {
  return {
    resendSendMock: vi.fn()
  };
});

vi.mock("resend", () => {
  return {
    Resend: class {
      emails = {
        send: resendSendMock
      };
    }
  };
});

import { buildRunId, toPrettyJson, writeHyperLog } from "@/tests/hyper/logging";

const INTEREST_MEMORY_TEXT = [
  "PERSONALITY:",
  "- prefers practical explainers with implementation details",
  "",
  "ACTIVE_INTERESTS:",
  "- AI engineering",
  "- distributed systems",
  "- software architecture",
  "- data engineering",
  "- observability",
  "- testing strategy",
  "- cloud cost optimization",
  "- product analytics",
  "- programming languages",
  "- behavioral economics",
  "",
  "SUPPRESSED_INTERESTS:",
  "- crypto",
  "",
  "RECENT_FEEDBACK:",
  "- less hype, more concrete tradeoffs"
].join("\n");

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

function missingLiveEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.PERPLEXITY_API_KEY) missing.push("PERPLEXITY_API_KEY");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.ANTHROPIC_MEMORY_MODEL && !process.env.ANTHROPIC_SUMMARY_MODEL) {
    missing.push("ANTHROPIC_MEMORY_MODEL|ANTHROPIC_SUMMARY_MODEL");
  }
  return missing;
}

describe("hyper integration: send pipeline live with mocked resend", () => {
  let pool: Pool;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;

    pool = new Pool({ connectionString: withPgTlsCompat(process.env.DATABASE_URL as string) });
    await pool.query("select 1");
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it.skipIf(missingLiveEnv().length > 0)(
    "runs live discovery+summary, mocks resend delivery, and persists post-send state",
    async () => {
      process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "resend_mock_key";
      resendSendMock.mockReset();
      resendSendMock.mockResolvedValue({ data: { id: "msg_mock_live_1" }, error: null });

      const email = `hyper-send-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;

      const insertedUser = await pool.query<{ id: string }>(
        `
        insert into public.users (email, preferred_name, timezone, send_time_local, interest_memory_text, last_issue_sent_at, sent_url_bloom_bits)
        values ($1, $2, $3, $4, $5, null, null)
        returning id
        `,
        [email, "Hyper", "UTC", "09:00", INTEREST_MEMORY_TEXT]
      );

      const userId = insertedUser.rows[0]?.id;
      expect(userId).toBeTruthy();

      const runAtUtc = new Date();

      try {
        const { sendUserNewsletter } = await import("@/lib/pipeline/send-user-newsletter");
        const result = await sendUserNewsletter({
          userId: userId as string,
          runAtUtc
        });

        const userRow = await pool.query<{ last_issue_sent_at: string | null; sent_url_bloom_bits: string | null }>(
          `
          select last_issue_sent_at, sent_url_bloom_bits
          from public.users
          where id = $1
          limit 1
          `,
          [userId]
        );

        const idempotencyRow = await pool.query<{ status: string; provider_message_id: string | null }>(
          `
          select status, provider_message_id
          from public.outbound_send_idempotency
          where idempotency_key = $1
          limit 1
          `,
          [result.idempotencyKey]
        );

        const runId = buildRunId("full-system-live-send");
        await writeHyperLog({
          group: "full-system",
          runId,
          fileName: "send-pipeline-result.txt",
          content: toPrettyJson({
            userId,
            runAtUtc: runAtUtc.toISOString(),
            result,
            userRow: userRow.rows[0] ?? null,
            idempotencyRow: idempotencyRow.rows[0] ?? null
          })
        });

        expect(result.status).toBe("sent");
        expect(result.itemCount).toBe(10);
        expect(resendSendMock).toHaveBeenCalledTimes(1);
        expect(userRow.rows[0]?.last_issue_sent_at).toBeTruthy();
        expect(userRow.rows[0]?.sent_url_bloom_bits).toBeTruthy();
        expect(idempotencyRow.rows[0]?.status).toBe("sent");
        expect(idempotencyRow.rows[0]?.provider_message_id).toBe("msg_mock_live_1");
      } finally {
        await pool.query(`delete from public.outbound_send_idempotency where user_id = $1`, [userId]);
        await pool.query(`delete from public.users where id = $1`, [userId]);
      }
    },
    240000
  );
});
