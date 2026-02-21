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
  mergeReplyIntoMemoryMock,
  sendTransactionalEmailMock,
  getSvixHeadersMock,
  verifyResendWebhookSignatureMock
} = vi.hoisted(() => {
  const state = {
    user: {
      id: "user-1",
      interestMemoryText:
        "PERSONALITY:\n- Curious\n\nACTIVE_INTERESTS:\n- AI\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-"
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
    mergeReplyIntoMemoryMock: vi.fn(async () => "PERSONALITY:\n- Updated\n\nACTIVE_INTERESTS:\n- Economics\n\nSUPPRESSED_INTERESTS:\n- Crypto\n\nRECENT_FEEDBACK:\n- Wants less crypto"),
    sendTransactionalEmailMock: vi.fn(async () => ({ ok: true, providerMessageId: "msg_auto_reply", attempts: 1, error: null })),
    getSvixHeadersMock: vi.fn(() => ({
      svixId: "msg_123",
      svixTimestamp: "1700000000",
      svixSignature: "v1,signature"
    })),
    verifyResendWebhookSignatureMock: vi.fn(() => true)
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

vi.mock("@/lib/email/send-newsletter", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock
}));

vi.mock("@/lib/webhooks/resend-signature", () => ({
  getSvixHeaders: getSvixHeadersMock,
  verifyResendWebhookSignature: verifyResendWebhookSignatureMock
}));

import { POST } from "@/app/api/webhooks/resend/inbound/route";

describe("POST /api/webhooks/resend/inbound", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_dGVzdF9zZWNyZXQ=";
    testState.user = {
      id: "user-1",
      interestMemoryText:
        "PERSONALITY:\n- Curious\n\nACTIVE_INTERESTS:\n- AI\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-"
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
    mergeReplyIntoMemoryMock.mockClear();
    sendTransactionalEmailMock.mockClear();
    getSvixHeadersMock.mockClear();
    verifyResendWebhookSignatureMock.mockClear();
  });

  it("returns 401 for invalid signature", async () => {
    verifyResendWebhookSignatureMock.mockReturnValueOnce(false);

    const response = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({ data: { from: "Naman <naman@example.com>", text: "more AI" } })
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error_code).toBe("INVALID_SIGNATURE");
  });

  it("returns ignored for replayed webhook id", async () => {
    testState.reserveSucceeds = false;

    const response = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({ data: { from: "Naman <naman@example.com>", text: "more AI" } })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, status: "ignored" });
    expect(mergeReplyIntoMemoryMock).not.toHaveBeenCalled();
    expect(testState.reservedWebhookKey).toBe("event:msg_123");
  });

  it("returns ignored for empty text", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({ data: { from: "Naman <naman@example.com>", text: "   " } })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, status: "ignored" });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("updates memory once for valid event", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({
          data: {
            email_id: "re_abc123",
            from: "Naman <naman@example.com>",
            text: "less crypto, more economics"
          }
        })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(testState.reservedWebhookKey).toBe("message:re_abc123");
  });

  it("sends helpful auto-reply when sender is unknown", async () => {
    testState.user = null;
    testState.linkedSubscribedEmail = "known-user@example.com";

    const response = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({
          data: {
            from: "Alt <alias@example.com>",
            text: "more ai",
            headers: { "in-reply-to": "<msg_known_1>" }
          }
        })
      })
    );

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
    const first = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({
          data: {
            email_id: "re_same_message_id",
            from: "Naman <naman@example.com>",
            text: "more economics"
          }
        })
      })
    );

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(testState.reservedWebhookKey).toBe("message:re_same_message_id");

    testState.reserveSucceeds = false;
    const second = await POST(
      new Request("http://localhost/api/webhooks/resend/inbound", {
        method: "POST",
        body: JSON.stringify({
          data: {
            email_id: "re_same_message_id",
            from: "Naman <naman@example.com>",
            text: "more economics"
          }
        })
      })
    );

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, status: "ignored" });
    expect(testState.reservedWebhookKey).toBe("message:re_same_message_id");
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledTimes(1);
  });
});
