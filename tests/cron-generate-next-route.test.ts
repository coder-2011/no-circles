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

  it("selects one due user and sends newsletter", async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ user_id: "user-123" }] });
    sendUserNewsletterMock.mockResolvedValueOnce({
      status: "sent",
      providerMessageId: "msg_123"
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
      status: "sent",
      user_id: "user-123",
      provider_message_id: "msg_123"
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(sendUserNewsletterMock).toHaveBeenCalledTimes(1);
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
    expect(executeMock).toHaveBeenCalledTimes(1);
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
      .mockResolvedValueOnce({ rows: [{ user_id: null }] })
      .mockResolvedValueOnce({ rows: [{ user_id: "user-boundary" }] });

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

    sendUserNewsletterMock.mockResolvedValueOnce({ status: "sent", providerMessageId: null });
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
      status: "sent",
      user_id: "user-boundary",
      provider_message_id: null
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(sendUserNewsletterMock).toHaveBeenCalledTimes(1);
  });

  it("returns no_due_user when rpc returns null user", async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ user_id: null }] });

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

  it("returns insufficient_content when pipeline reports shortfall", async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ user_id: "user-123" }] });
    sendUserNewsletterMock.mockResolvedValueOnce({
      status: "insufficient_content",
      error: "INSUFFICIENT_QUALITY_CANDIDATES"
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
      status: "insufficient_content",
      user_id: "user-123"
    });
  });

  it("returns send_failed when pipeline send fails", async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ user_id: "user-123" }] });
    sendUserNewsletterMock.mockResolvedValueOnce({
      status: "send_failed",
      error: "RESEND_ERROR"
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
      status: "send_failed",
      user_id: "user-123"
    });
  });

  it("returns 500 when pipeline returns internal_error", async () => {
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

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "INTERNAL_ERROR",
      message: "Failed to process selected user."
    });
  });
});
