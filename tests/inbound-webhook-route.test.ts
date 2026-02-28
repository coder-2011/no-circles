import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  testState,
  selectMock,
  fromMock,
  innerJoinMock,
  whereMock,
  orderByMock,
  limitMock,
  transactionMock,
  receivingGetMock,
  emailGetMock,
  mergeReplyIntoMemoryMock,
  recordRecentEmailHistoryMock,
  sendTransactionalEmailMock,
  getSvixHeadersMock,
  verifyResendWebhookSignatureMock,
  logInfoMock,
  logWarnMock,
  logErrorMock
} = vi.hoisted(() => {
  const state = {
    user: {
      id: "user-1",
      interestMemoryText: "PERSONALITY:\n- Curious\n\nACTIVE_INTERESTS:\n- AI\n\nRECENT_FEEDBACK:\n-"
    } as { id: string; interestMemoryText: string } | null,
    reserveSucceeds: true,
    reservedWebhookKey: null as string | null,
    linkedSubscribedEmail: null as string | null,
    limitCallCount: 0
  };

  type TransactionContext = {
    insert: () => {
      values: () => {
        onConflictDoNothing: () => {
          returning: () => Promise<Array<{ id: string }>>;
        };
      };
    };
    update: () => {
      set: () => {
        where: () => Promise<void>;
      };
    };
  };

  const limit = vi.fn(async () => {
    state.limitCallCount += 1;
    if (state.user) {
      return [state.user];
    }

    if (state.linkedSubscribedEmail && state.limitCallCount > 1) {
      return [{ email: state.linkedSubscribedEmail }];
    }

    return [];
  });
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ limit, orderBy }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ where, innerJoin }));
  const select = vi.fn(() => ({ from }));

  const transaction = vi.fn(async (callback: (tx: TransactionContext) => Promise<"ignored" | "updated">) => {
    const tx: TransactionContext = {
      insert: vi.fn(() => ({
        values: vi.fn((values: { provider: string; webhookId: string }) => {
          state.reservedWebhookKey = values.webhookId;
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => (state.reserveSucceeds ? [{ id: "event-1" }] : []))
            }))
          };
        })
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined)
        }))
      }))
    };

    return callback(tx);
  });

  return {
    testState: state,
    selectMock: select,
    fromMock: from,
    innerJoinMock: innerJoin,
    whereMock: where,
    orderByMock: orderBy,
    limitMock: limit,
    transactionMock: transaction,
    receivingGetMock: vi.fn(async () => ({ data: { text: "more AI depth" }, error: null })),
    emailGetMock: vi.fn(async () => ({ data: { text: "more AI depth" }, error: null })),
    mergeReplyIntoMemoryMock: vi.fn(
      async () => "PERSONALITY:\n- Updated\n\nACTIVE_INTERESTS:\n- Economics\n\nRECENT_FEEDBACK:\n- Wants less crypto"
    ),
    recordRecentEmailHistoryMock: vi.fn(async () => undefined),
    sendTransactionalEmailMock: vi.fn(async () => ({ ok: true, providerMessageId: "msg_auto_reply", attempts: 1, error: null })),
    getSvixHeadersMock: vi.fn(() => ({
      svixId: "msg_123",
      svixTimestamp: "1700000000",
      svixSignature: "v1,signature"
    })),
    verifyResendWebhookSignatureMock: vi.fn(() => true),
    logInfoMock: vi.fn(),
    logWarnMock: vi.fn(),
    logErrorMock: vi.fn()
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
    transaction: transactionMock
  }
}));

vi.mock("@/lib/memory/processors", () => ({
  mergeReplyIntoMemory: mergeReplyIntoMemoryMock
}));

vi.mock("@/lib/memory/email-history", () => ({
  recordRecentEmailHistory: recordRecentEmailHistoryMock
}));

vi.mock("@/lib/email/send-newsletter", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      receiving: {
        get: receivingGetMock
      },
      get: emailGetMock
    };
  }
}));

vi.mock("@/lib/webhooks/resend-signature", () => ({
  getSvixHeaders: getSvixHeadersMock,
  verifyResendWebhookSignature: verifyResendWebhookSignatureMock
}));

vi.mock("@/lib/observability/log", () => ({
  logInfo: logInfoMock,
  logWarn: logWarnMock,
  logError: logErrorMock
}));

import { GET, POST } from "@/app/api/webhooks/resend/inbound/route";

function buildInboundRequest(body: unknown): Request {
  return new Request("http://localhost/api/webhooks/resend/inbound", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

describe("POST /api/webhooks/resend/inbound", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_dGVzdF9zZWNyZXQ=";
    process.env.RESEND_API_KEY = "re_test_key";
    testState.user = {
      id: "user-1",
      interestMemoryText: "PERSONALITY:\n- Curious\n\nACTIVE_INTERESTS:\n- AI\n\nRECENT_FEEDBACK:\n-"
    };
    testState.reserveSucceeds = true;
    testState.reservedWebhookKey = null;
    testState.linkedSubscribedEmail = null;
    testState.limitCallCount = 0;

    selectMock.mockClear();
    fromMock.mockClear();
    innerJoinMock.mockClear();
    whereMock.mockClear();
    orderByMock.mockClear();
    limitMock.mockClear();
    transactionMock.mockClear();
    receivingGetMock.mockReset();
    receivingGetMock.mockResolvedValue({ data: { text: "more AI depth" }, error: null });
    emailGetMock.mockReset();
    emailGetMock.mockResolvedValue({ data: { text: "more AI depth" }, error: null });
    mergeReplyIntoMemoryMock.mockReset();
    mergeReplyIntoMemoryMock.mockResolvedValue(
      "PERSONALITY:\n- Updated\n\nACTIVE_INTERESTS:\n- Economics\n\nRECENT_FEEDBACK:\n- Wants less crypto"
    );
    recordRecentEmailHistoryMock.mockReset();
    recordRecentEmailHistoryMock.mockResolvedValue(undefined);
    sendTransactionalEmailMock.mockReset();
    sendTransactionalEmailMock.mockResolvedValue({
      ok: true,
      providerMessageId: "msg_auto_reply",
      attempts: 1,
      error: null
    });
    getSvixHeadersMock.mockReset();
    getSvixHeadersMock.mockReturnValue({
      svixId: "msg_123",
      svixTimestamp: "1700000000",
      svixSignature: "v1,signature"
    });
    verifyResendWebhookSignatureMock.mockReset();
    verifyResendWebhookSignatureMock.mockReturnValue(true);
    logInfoMock.mockClear();
    logWarnMock.mockClear();
    logErrorMock.mockClear();
  });

  it("returns 401 for invalid signature", async () => {
    verifyResendWebhookSignatureMock.mockReturnValueOnce(false);

    const response = await POST(buildInboundRequest({ data: { from: "Naman <naman@example.com>", text: "more AI" } }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error_code).toBe("INVALID_SIGNATURE");
    expect(logWarnMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "invalid_signature",
      expect.objectContaining({ route: "POST /api/webhooks/resend/inbound", svix_id: "msg_123" })
    );
  });

  it("returns 401 when signature headers are missing", async () => {
    getSvixHeadersMock.mockReturnValueOnce(null);

    const response = await POST(buildInboundRequest({ data: { from: "Naman <naman@example.com>", text: "more AI" } }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "INVALID_SIGNATURE",
      message: "Missing webhook signature headers."
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "missing_signature_headers",
      expect.objectContaining({ route: "POST /api/webhooks/resend/inbound" })
    );
  });

  it("returns ignored for replayed webhook id", async () => {
    testState.reserveSucceeds = false;

    const response = await POST(buildInboundRequest({ data: { from: "Naman <naman@example.com>", text: "more AI" } }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, status: "ignored" });
    expect(mergeReplyIntoMemoryMock).not.toHaveBeenCalled();
    expect(testState.reservedWebhookKey).toBe("event:msg_123");
    expect(logInfoMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "ignored_replay",
      expect.objectContaining({ dedupe_key: "event:msg_123", user_id: "user-1" })
    );
  });

  it("returns ignored for empty text", async () => {
    const response = await POST(buildInboundRequest({ data: { from: "Naman <naman@example.com>", text: "   " } }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, status: "ignored" });
    expect(transactionMock).not.toHaveBeenCalled();
    expect(logInfoMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "ignored_empty_text",
      expect.objectContaining({ sender_email: "naman@example.com" })
    );
  });

  it("updates memory once for valid event", async () => {
    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_abc123",
        from: "Naman <naman@example.com>",
        text: "less crypto, more economics"
      }
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(testState.reservedWebhookKey).toBe("message:re_abc123");
    expect(logInfoMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "updated",
      expect.objectContaining({ user_id: "user-1" })
    );
  });

  it("fetches inbound text by email_id when inline text is missing", async () => {
    receivingGetMock.mockResolvedValueOnce({
      data: { text: "less company coverage, more AI papers" },
      error: null
    });

    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_payload_only",
        from: "Naman <naman@example.com>"
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(receivingGetMock).toHaveBeenCalledWith("re_payload_only");
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledWith(
      expect.any(String),
      "less company coverage, more AI papers"
    );
    expect(testState.reservedWebhookKey).toBe("message:re_payload_only");
  });

  it("extracts only newest reply content from threaded receiving text", async () => {
    receivingGetMock.mockResolvedValueOnce({
      data: {
        text: "Give me less mech interp and more cool Biology theories and tell me less about companies.\n\nOn Sun, Feb 22, 2026 at 11:28 AM Naman Chetwani <naman.chetwani@gmail.com> wrote:\n> old reply\n> quoted body"
      },
      error: null
    });

    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_threaded_text",
        from: "Naman <naman@example.com>"
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledWith(
      expect.any(String),
      "Give me less mech interp and more cool Biology theories and tell me less about companies."
    );
  });

  it("prefers inline webhook text over fetched email content when both exist", async () => {
    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_inline_preferred",
        from: "Naman <naman@example.com>",
        text: "inline text should win"
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(receivingGetMock).not.toHaveBeenCalled();
    expect(emailGetMock).not.toHaveBeenCalled();
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledWith(expect.any(String), "inline text should win");
  });

  it("extracts reply from Gmail-style html dir=auto block", async () => {
    receivingGetMock.mockResolvedValueOnce({
      data: {
        text: null,
        html: "<div dir=\"ltr\"><div dir=\"auto\">Give me less companies and more AI papers</div></div><div class=\"gmail_quote\">quoted</div>"
      },
      error: null
    });

    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_html_top_reply",
        from: "Naman <naman@example.com>"
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledWith(
      expect.any(String),
      "Give me less companies and more AI papers"
    );
    expect(emailGetMock).not.toHaveBeenCalled();
  });

  it("splits concatenated Gmail plain text boundary before quoted thread", async () => {
    receivingGetMock.mockResolvedValueOnce({
      data: {
        text: "Give me less mech interp and more biology theoriesOn Sun, Feb 22, 2026 at 11:28 AM Naman wrote:\n> quoted"
      },
      error: null
    });

    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_concat_boundary",
        from: "Naman <naman@example.com>"
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledWith(
      expect.any(String),
      "Give me less mech interp and more biology theories"
    );
  });

  it("falls back to emails.get when receiving text is missing", async () => {
    receivingGetMock.mockResolvedValueOnce({
      data: { text: null },
      error: null
    });
    emailGetMock.mockResolvedValueOnce({
      data: { text: "more biology theory, less mech interp" },
      error: null
    });

    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_payload_fallback",
        from: "Naman <naman@example.com>"
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(receivingGetMock).toHaveBeenCalledWith("re_payload_fallback");
    expect(emailGetMock).toHaveBeenCalledWith("re_payload_fallback");
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledWith(
      expect.any(String),
      "more biology theory, less mech interp"
    );
  });

  it("returns ignored when text is unavailable after fetch by email_id", async () => {
    receivingGetMock.mockResolvedValueOnce({
      data: { text: null },
      error: null
    });
    emailGetMock.mockResolvedValueOnce({
      data: { text: null },
      error: null
    });

    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_payload_empty",
        from: "Naman <naman@example.com>"
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "ignored" });
    expect(mergeReplyIntoMemoryMock).not.toHaveBeenCalled();
    expect(logInfoMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "ignored_empty_text",
      expect.objectContaining({ sender_email: "naman@example.com", email_id_present: true })
    );
  });

  it("returns 500 when receiving content fetch fails", async () => {
    receivingGetMock.mockResolvedValueOnce({
      data: null,
      error: { message: "forbidden" }
    });

    const response = await POST(buildInboundRequest({
      data: {
        email_id: "re_fetch_error",
        from: "Naman <naman@example.com>"
      }
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "INTERNAL_ERROR",
      message: "Failed to fetch inbound email content."
    });
    expect(transactionMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "email_content_fetch_failed",
      expect.objectContaining({ email_id: "re_fetch_error" })
    );
  });

  it("sends helpful auto-reply when sender is unknown", async () => {
    testState.user = null;
    testState.linkedSubscribedEmail = "known-user@example.com";

    const response = await POST(buildInboundRequest({
      data: {
        from: "Alt <alias@example.com>",
        text: "more ai",
        headers: { "in-reply-to": "<msg_known_1>" }
      }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "ignored" });
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alias@example.com",
        subject: "Use your subscribed email to update No Circles"
      })
    );
    expect(transactionMock).not.toHaveBeenCalled();
    expect(logInfoMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "ignored_unknown_sender",
      expect.objectContaining({ sender_email: "alias@example.com" })
    );
  });

  it("ignores replay when provider message id repeats even if svix-id changes", async () => {
    getSvixHeadersMock
      .mockReturnValueOnce({
        svixId: "evt_one",
        svixTimestamp: "1700000000",
        svixSignature: "v1,signature"
      })
      .mockReturnValueOnce({
        svixId: "evt_two",
        svixTimestamp: "1700000001",
        svixSignature: "v1,signature"
      });

    testState.reserveSucceeds = true;
    const first = await POST(buildInboundRequest({
      data: {
        email_id: "re_same_message_id",
        from: "Naman <naman@example.com>",
        text: "more economics"
      }
    }));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(testState.reservedWebhookKey).toBe("message:re_same_message_id");

    testState.reserveSucceeds = false;
    const second = await POST(buildInboundRequest({
      data: {
        email_id: "re_same_message_id",
        from: "Naman <naman@example.com>",
        text: "more economics"
      }
    }));

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, status: "ignored" });
    expect(testState.reservedWebhookKey).toBe("message:re_same_message_id");
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledTimes(1);
  });

  it("returns 405 for GET requests", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed."
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "method_not_allowed",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("returns 415 when content-type is not application/json", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({ data: { from: "Naman <naman@example.com>", text: "more AI" } }),
        headers: { "content-type": "text/plain" }
      })
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Expected application/json."
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "unsupported_media_type",
      expect.objectContaining({ route: "POST /api/webhooks/resend/inbound" })
    );
  });

  it("returns 413 when payload exceeds size limit", async () => {
    const response = await POST(
      buildInboundRequest({
        data: {
          from: "Naman <naman@example.com>",
          text: "x".repeat(20_000)
        }
      })
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      ok: false,
      error_code: "PAYLOAD_TOO_LARGE",
      message: "Inbound payload exceeds size limit."
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "webhook_inbound",
      "payload_too_large",
      expect.objectContaining({ route: "POST /api/webhooks/resend/inbound", svix_id: "msg_123" })
    );
  });
});
