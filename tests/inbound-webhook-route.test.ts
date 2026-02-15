import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  testState,
  selectMock,
  fromMock,
  whereMock,
  limitMock,
  transactionMock,
  mergeReplyIntoMemoryMock,
  getSvixHeadersMock,
  verifyResendWebhookSignatureMock
} = vi.hoisted(() => {
  const state = {
    user: {
      id: "user-1",
      interestMemoryText:
        "PERSONALITY:\n- Curious\n\nACTIVE_INTERESTS:\n- AI\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-"
    } as { id: string; interestMemoryText: string } | null,
    reserveSucceeds: true
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

  const limit = vi.fn(async () => (state.user ? [state.user] : []));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  const transaction = vi.fn(async (callback: (tx: TransactionContext) => Promise<"ignored" | "updated">) => {
    const tx: TransactionContext = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => (state.reserveSucceeds ? [{ id: "event-1" }] : []))
          }))
        }))
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
    whereMock: where,
    limitMock: limit,
    transactionMock: transaction,
    mergeReplyIntoMemoryMock: vi.fn(async () => "PERSONALITY:\n- Updated\n\nACTIVE_INTERESTS:\n- Economics\n\nSUPPRESSED_INTERESTS:\n- Crypto\n\nRECENT_FEEDBACK:\n- Wants less crypto"),
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

    selectMock.mockClear();
    fromMock.mockClear();
    whereMock.mockClear();
    limitMock.mockClear();
    transactionMock.mockClear();
    mergeReplyIntoMemoryMock.mockClear();
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
        body: JSON.stringify({ data: { from: "Naman <naman@example.com>", text: "less crypto, more economics" } })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, status: "updated", user_id: "user-1" });
    expect(mergeReplyIntoMemoryMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
