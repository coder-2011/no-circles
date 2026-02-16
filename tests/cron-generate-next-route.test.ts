import { beforeEach, describe, expect, it, vi } from "vitest";

const { transactionMock, executeMock } = vi.hoisted(() => {
  const execute = vi.fn();
  const transaction = vi.fn(async (callback: (tx: { execute: typeof execute }) => Promise<unknown>) => {
    return callback({ execute });
  });

  return {
    transactionMock: transaction,
    executeMock: execute
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: transactionMock
  }
}));

import { POST } from "@/app/api/cron/generate-next/route";

describe("POST /api/cron/generate-next", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    transactionMock.mockClear();
    executeMock.mockClear();
  });

  it("rejects unauthorized requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" }
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "UNAUTHORIZED",
      message: "Unauthorized."
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("selects one due user", async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ id: "user-123" }] });

    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "selected", user_id: "user-123" });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("returns no_due_user when none are due", async () => {
    executeMock.mockResolvedValueOnce({ rows: [] });

    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "no_due_user" });
  });

  it("returns no_due_user when all candidates were already sent today", async () => {
    executeMock.mockResolvedValueOnce({ rows: [] });

    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({ run_at_utc: "2026-02-16T18:00:00.000Z" }),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "no_due_user" });
  });

  it("handles timezone boundary runs around local midnight", async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "user-boundary" }] });

    const beforeMidnightResponse = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({ run_at_utc: "2026-02-16T13:59:00.000Z" }),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(beforeMidnightResponse.status).toBe(200);
    expect(await beforeMidnightResponse.json()).toEqual({ ok: true, status: "no_due_user" });

    const afterMidnightResponse = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({ run_at_utc: "2026-02-16T14:01:00.000Z" }),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(afterMidnightResponse.status).toBe(200);
    expect(await afterMidnightResponse.json()).toEqual({
      ok: true,
      status: "selected",
      user_id: "user-boundary"
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it("returns 400 on invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({ run_at_utc: "not-a-date" }),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "INVALID_PAYLOAD",
      message: "Invalid cron payload."
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
