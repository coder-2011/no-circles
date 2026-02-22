import { beforeEach, describe, expect, it, vi } from "vitest";

const { emailSendMock } = vi.hoisted(() => {
  return {
    emailSendMock: vi.fn()
  };
});

vi.mock("resend", () => {
  return {
    Resend: class {
      emails = {
        send: emailSendMock
      };
    }
  };
});

import { sendNewsletter } from "@/lib/email/send-newsletter";

describe("sendNewsletter", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "resend_key";
    process.env.RESEND_FROM_EMAIL = "No-Circles <newsletter@updates.nocircles.com>";
    emailSendMock.mockReset();
  });

  it("sends successfully and returns provider message id", async () => {
    emailSendMock.mockResolvedValueOnce({ data: { id: "msg_1" }, error: null });

    const result = await sendNewsletter({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hello</p>",
      text: "Hello",
      idempotencyKey: "key-1"
    });

    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe("msg_1");
    expect(result.attempts).toBe(1);
  });

  it("retries once when first send attempt fails", async () => {
    emailSendMock
      .mockResolvedValueOnce({ data: null, error: { message: "provider down" } })
      .mockResolvedValueOnce({ data: { id: "msg_2" }, error: null });

    const result = await sendNewsletter({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hello</p>",
      text: "Hello",
      idempotencyKey: "key-1"
    });

    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe("msg_2");
    expect(result.attempts).toBe(2);
    expect(emailSendMock).toHaveBeenCalledTimes(2);
  });

  it("returns failure after two failed attempts", async () => {
    emailSendMock
      .mockResolvedValueOnce({ data: null, error: { message: "provider down" } })
      .mockResolvedValueOnce({ data: null, error: { message: "still down" } });

    const result = await sendNewsletter({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hello</p>",
      text: "Hello",
      idempotencyKey: "key-1"
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.error).toBe("still down");
  });
});
