import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedUserEmailMock,
  formatOnboardingMemoryMock,
  sendTransactionalEmailMock,
  sendUserNewsletterMock,
  afterMock,
  returningMock,
  onConflictDoUpdateMock,
  valuesMock,
  insertMock
} = vi.hoisted(() => {
  const getAuthenticatedUserEmail = vi.fn();
  const formatOnboardingMemory = vi.fn();
  const sendTransactionalEmail = vi.fn(async () => ({ ok: true, providerMessageId: "intro_1", attempts: 1, error: null }));
  const sendUserNewsletter = vi.fn(async () => ({ status: "sent", providerMessageId: "msg_1" }));
  const after = vi.fn((callback: () => Promise<void> | void) => {
    void callback();
  });
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  return {
    getAuthenticatedUserEmailMock: getAuthenticatedUserEmail,
    formatOnboardingMemoryMock: formatOnboardingMemory,
    sendTransactionalEmailMock: sendTransactionalEmail,
    sendUserNewsletterMock: sendUserNewsletter,
    afterMock: after,
    returningMock: returning,
    onConflictDoUpdateMock: onConflictDoUpdate,
    valuesMock: values,
    insertMock: insert
  };
});

vi.mock("@/lib/auth/server-user", () => ({
  getAuthenticatedUserEmail: getAuthenticatedUserEmailMock
}));

vi.mock("@/lib/memory/processors", () => ({
  formatOnboardingMemory: formatOnboardingMemoryMock
}));

vi.mock("@/lib/pipeline/send-user-newsletter", () => ({
  sendUserNewsletter: sendUserNewsletterMock
}));

vi.mock("@/lib/email/send-newsletter", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock
}));

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

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: afterMock
  };
});

import { POST } from "@/app/api/onboarding/route";

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    getAuthenticatedUserEmailMock.mockClear();
    getAuthenticatedUserEmailMock.mockResolvedValue("session-user@example.com");
    formatOnboardingMemoryMock.mockClear();
    formatOnboardingMemoryMock.mockResolvedValue(
      "PERSONALITY:\n- Curious learner\n\nACTIVE_INTERESTS:\n- AI and coding\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n- Initialized from onboarding brain dump"
    );
    insertMock.mockClear();
    valuesMock.mockClear();
    onConflictDoUpdateMock.mockClear();
    returningMock.mockClear();
    sendTransactionalEmailMock.mockClear();
    sendUserNewsletterMock.mockClear();
    afterMock.mockClear();
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

  it("returns 415 when content-type is not application/json", async () => {
    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        preferred_name: "Naman",
        timezone: "America/New_York",
        send_time_local: "09:30",
        brain_dump_text: "AI and coding."
      }),
      headers: { "content-type": "text/plain" }
    });

    const response = await POST(request);
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Expected application/json."
    });
    expect(getAuthenticatedUserEmailMock).not.toHaveBeenCalled();
  });

  it("returns 413 when payload exceeds size limit", async () => {
    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        preferred_name: "Naman",
        timezone: "America/New_York",
        send_time_local: "09:30",
        brain_dump_text: "a".repeat(70_000)
      }),
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "PAYLOAD_TOO_LARGE",
      message: "Onboarding payload exceeds size limit."
    });
    expect(getAuthenticatedUserEmailMock).not.toHaveBeenCalled();
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
    expect(getAuthenticatedUserEmailMock).not.toHaveBeenCalled();
  });

  it("returns 401 when request has no authenticated session", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        preferred_name: "Naman",
        timezone: "America/New_York",
        send_time_local: "09:30",
        brain_dump_text: "AI and coding."
      }),
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error_code: "UNAUTHORIZED",
      message: "Unauthorized."
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("upserts onboarding payload and returns user id", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce("naman@example.com");
    returningMock.mockResolvedValueOnce([{ id: "user-123", wasInserted: false }]);

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
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
      preferredName: "Naman",
      timezone: "America/New_York",
      sendTimeLocal: "09:30",
      interestMemoryText:
        "PERSONALITY:\n- Curious learner\n\nACTIVE_INTERESTS:\n- AI and coding\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n- Initialized from onboarding brain dump"
    });
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdateMock).toHaveBeenCalledWith({
      target: "email",
      set: {
        preferredName: "Naman",
        timezone: "America/New_York",
        sendTimeLocal: "09:30",
        interestMemoryText:
          "PERSONALITY:\n- Curious learner\n\nACTIVE_INTERESTS:\n- AI and coding\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n- Initialized from onboarding brain dump"
      }
    });
    expect(returningMock).toHaveBeenCalledTimes(1);
    expect(afterMock).not.toHaveBeenCalled();
    expect(sendUserNewsletterMock).not.toHaveBeenCalled();
  });

  it("ignores payload email and uses authenticated session email", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce("session-email@example.com");
    returningMock.mockResolvedValueOnce([{ id: "user-123", wasInserted: false }]);

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        email: "spoofed@example.com",
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
    expect(valuesMock).toHaveBeenCalledWith({
      email: "session-email@example.com",
      preferredName: "Naman",
      timezone: "America/New_York",
      sendTimeLocal: "09:30",
      interestMemoryText:
        "PERSONALITY:\n- Curious learner\n\nACTIVE_INTERESTS:\n- AI and coding\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n- Initialized from onboarding brain dump"
    });
  });

  it("persists trimmed preferred_name", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce("naman@example.com");
    returningMock.mockResolvedValueOnce([{ id: "user-123", wasInserted: false }]);

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        preferred_name: "  Naman  ",
        timezone: "America/New_York",
        send_time_local: "09:30",
        brain_dump_text: "AI and coding."
      }),
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(valuesMock).toHaveBeenCalledWith({
      email: "naman@example.com",
      preferredName: "Naman",
      timezone: "America/New_York",
      sendTimeLocal: "09:30",
      interestMemoryText:
        "PERSONALITY:\n- Curious learner\n\nACTIVE_INTERESTS:\n- AI and coding\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n- Initialized from onboarding brain dump"
    });
  });

  it("returns 500 when db write fails", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce("naman@example.com");
    insertMock.mockImplementationOnce(() => {
      throw new Error("db offline");
    });

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
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

  it("sends welcome issue for first successful onboarding insert", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce("new-user@example.com");
    returningMock.mockResolvedValueOnce([{ id: "user-new", wasInserted: true }]);

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        preferred_name: "New User",
        timezone: "America/New_York",
        send_time_local: "09:30",
        brain_dump_text: "AI and coding."
      }),
      headers: { "content-type": "application/json" }
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmailMock).toHaveBeenCalledWith({
      to: "new-user@example.com",
      subject: "Welcome to The No-Circles Project",
      html: expect.stringContaining("Your first brief arrives as a separate email right after this one."),
      text: expect.stringContaining("Your first brief arrives as a separate email right after this one.")
    });
    expect(sendUserNewsletterMock).toHaveBeenCalledTimes(1);
    expect(sendUserNewsletterMock).toHaveBeenCalledWith({
      userId: "user-new",
      runAtUtc: expect.any(Date),
      targetItemCount: 5,
      issueVariant: "welcome"
    });
    expect(sendTransactionalEmailMock.mock.invocationCallOrder[0]).toBeLessThan(sendUserNewsletterMock.mock.invocationCallOrder[0]);
  });

  it("returns 500 when onboarding memory processing fails", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce("naman@example.com");
    formatOnboardingMemoryMock.mockRejectedValueOnce(new Error("model offline"));

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
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
      message: "Failed to process onboarding memory."
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns model auth error when onboarding memory call fails with Anthropic auth failure", async () => {
    getAuthenticatedUserEmailMock.mockResolvedValueOnce("naman@example.com");
    formatOnboardingMemoryMock.mockRejectedValueOnce(new Error("ANTHROPIC_AUTH_FAILED"));

    const request = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
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
      error_code: "MODEL_AUTH_ERROR",
      message: "Anthropic authentication failed. Check server API key env and restart dev server."
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
