import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  returningMock,
  onConflictDoUpdateMock,
  valuesMock,
  insertMock
} = vi.hoisted(() => {
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  return {
    returningMock: returning,
    onConflictDoUpdateMock: onConflictDoUpdate,
    valuesMock: values,
    insertMock: insert
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: insertMock
  }
}));

vi.mock("@/lib/db/schema", () => ({
  users: {
    id: "id",
    email: "email"
  }
}));

import { POST } from "@/app/api/onboarding/route";

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    insertMock.mockClear();
    valuesMock.mockClear();
    onConflictDoUpdateMock.mockClear();
    returningMock.mockClear();
  });

  it("returns 400 on invalid payload", async () => {
    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ preferred_name: "Naman" }),
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error_code: "INVALID_PAYLOAD",
      message: "Invalid onboarding payload."
    });
  });

  it("returns 400 on malformed json body", async () => {
    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: "{ not-valid-json }",
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error_code: "INVALID_PAYLOAD",
      message: "Invalid onboarding payload."
    });
  });

  it("upserts onboarding payload and returns user id", async () => {
    returningMock.mockResolvedValueOnce([{ id: "user-123" }]);

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        email: "naman@example.com",
        preferred_name: "Naman",
        timezone: "America/New_York",
        send_time_local: "09:30",
        brain_dump_text: "AI and coding."
      }),
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, user_id: "user-123" });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith({
      email: "naman@example.com",
      timezone: "America/New_York",
      sendTimeLocal: "09:30",
      interestMemoryText: "AI and coding."
    });
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1);
    expect(returningMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when db write fails", async () => {
    insertMock.mockImplementationOnce(() => {
      throw new Error("db offline");
    });

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        email: "naman@example.com",
        preferred_name: "Naman",
        timezone: "America/New_York",
        send_time_local: "09:30",
        brain_dump_text: "AI and coding."
      }),
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error_code: "INTERNAL_ERROR",
      message: "Failed to persist onboarding data."
    });
  });
});
