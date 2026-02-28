import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: {
    execute: vi.fn()
  }
}));

import { db } from "@/lib/db/client";
import { buildOutboundIdempotencyKey, reserveOutboundSendIdempotency } from "@/lib/send/idempotency";

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildOutboundIdempotencyKey", () => {
  it("builds per-user, per-local-date key", () => {
    const result = buildOutboundIdempotencyKey({
      userId: "user-1",
      timezone: "America/Los_Angeles",
      runAtUtc: new Date("2026-02-16T07:30:00.000Z"),
      issueVariant: "daily"
    });

    expect(result.localIssueDate).toBe("2026-02-15");
    expect(result.idempotencyKey).toBe("newsletter:v1:daily:user-1:2026-02-15");
  });

  it("separates welcome from daily keys on the same local date", () => {
    const daily = buildOutboundIdempotencyKey({
      userId: "user-1",
      timezone: "America/Los_Angeles",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      issueVariant: "daily"
    });
    const welcome = buildOutboundIdempotencyKey({
      userId: "user-1",
      timezone: "America/Los_Angeles",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      issueVariant: "welcome"
    });

    expect(daily.localIssueDate).toBe("2026-02-16");
    expect(welcome.localIssueDate).toBe("2026-02-16");
    expect(daily.idempotencyKey).toBe("newsletter:v1:daily:user-1:2026-02-16");
    expect(welcome.idempotencyKey).toBe("newsletter:v1:welcome:user-1:2026-02-16");
  });
});

describe("reserveOutboundSendIdempotency", () => {
  it("returns typed already_sent outcome from SQL row", async () => {
    const executeMock = vi.mocked(db.execute);
    executeMock.mockResolvedValueOnce({
      rows: [{ outcome: "already_sent", status: "sent", provider_message_id: "msg_1" }]
    } as Awaited<ReturnType<typeof db.execute>>);

    const result = await reserveOutboundSendIdempotency({
      userId: "user-1",
      idempotencyKey: "newsletter:v1:daily:user-1:2026-02-16",
      localIssueDate: "2026-02-16",
      issueVariant: "daily"
    });

    expect(result).toEqual({
      outcome: "already_sent",
      status: "sent",
      providerMessageId: "msg_1"
    });
  });

  it("throws on invalid SQL outcome to avoid silent misclassification", async () => {
    const executeMock = vi.mocked(db.execute);
    executeMock.mockResolvedValueOnce({
      rows: [{ outcome: "unknown", status: "processing", provider_message_id: null }]
    } as Awaited<ReturnType<typeof db.execute>>);

    await expect(
      reserveOutboundSendIdempotency({
        userId: "user-1",
        idempotencyKey: "newsletter:v1:daily:user-1:2026-02-16",
        localIssueDate: "2026-02-16",
        issueVariant: "daily"
      })
    ).rejects.toThrow("IDEMPOTENCY_RESERVE_INVALID_OUTCOME:unknown");
  });
});
