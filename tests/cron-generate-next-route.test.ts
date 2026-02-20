import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock } = vi.hoisted(() => {
  const execute = vi.fn();

  return {
    executeMock: execute
  };
});

const { sendUserNewsletterMock } = vi.hoisted(() => {
  const sendUserNewsletter = vi.fn();

  return { sendUserNewsletterMock: sendUserNewsletter };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    execute: executeMock
  }
}));

vi.mock("@/lib/pipeline/send-user-newsletter", () => ({
  sendUserNewsletter: sendUserNewsletterMock
}));

import { POST } from "@/app/api/cron/generate-next/route";

describe("POST /api/cron/generate-next", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    executeMock.mockClear();
    sendUserNewsletterMock.mockClear();
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
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("rejects requests when bearer token is incorrect", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-secret"
        }
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "UNAUTHORIZED",
      message: "Unauthorized."
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("rejects requests when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;

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

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "UNAUTHORIZED",
      message: "Unauthorized."
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns no_due_user when selector returns no rows", async () => {
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
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(sendUserNewsletterMock).not.toHaveBeenCalled();
  });

  it("processes a claimed batch and returns per-status counts", async () => {
    executeMock.mockResolvedValueOnce({
      rows: [{ user_id: "user-1" }, { user_id: "user-2" }, { user_id: "user-3" }]
    });
    sendUserNewsletterMock
      .mockResolvedValueOnce({ status: "sent", providerMessageId: "msg_1" })
      .mockResolvedValueOnce({ status: "insufficient_content", error: "INSUFFICIENT_QUALITY_CANDIDATES" })
      .mockResolvedValueOnce({ status: "send_failed", error: "RESEND_ERROR" });

    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({ batch_size: 3 }),
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "processed_batch",
      requested_batch_size: 3,
      claimed_user_count: 3,
      counts: {
        sent: 1,
        insufficient_content: 1,
        send_failed: 1,
        internal_error: 0
      },
      user_results: [
        { user_id: "user-1", status: "sent", provider_message_id: "msg_1" },
        { user_id: "user-2", status: "insufficient_content", provider_message_id: null },
        { user_id: "user-3", status: "send_failed", provider_message_id: null }
      ]
    });
    expect(sendUserNewsletterMock).toHaveBeenCalledTimes(3);
  });

  it("includes internal_error results in batch summary", async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ user_id: "user-123" }] });
    sendUserNewsletterMock.mockResolvedValueOnce({
      status: "internal_error",
      error: "USER_NOT_FOUND"
    });

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
    expect(await response.json()).toEqual({
      ok: true,
      status: "processed_batch",
      requested_batch_size: 3,
      claimed_user_count: 1,
      counts: {
        sent: 0,
        insufficient_content: 0,
        send_failed: 0,
        internal_error: 1
      },
      user_results: [{ user_id: "user-123", status: "internal_error", provider_message_id: null }]
    });
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
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when batch_size exceeds validation bounds", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: JSON.stringify({ batch_size: 26 }),
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
  });

  it("treats malformed json body as empty payload", async () => {
    executeMock.mockResolvedValueOnce({ rows: [] });

    const response = await POST(
      new Request("http://localhost/api/cron/generate-next", {
        method: "POST",
        body: "{ not-valid-json }",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "no_due_user" });
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when selector query fails", async () => {
    executeMock.mockRejectedValueOnce(new Error("db offline"));

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

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "INTERNAL_ERROR",
      message: "Failed to select due user."
    });
  });
});
