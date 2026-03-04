import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  reserveWebhookEventMock,
  logInfoMock,
  logWarnMock,
  logErrorMock,
  appendRecentFeedbackLinesMock,
  dbState,
  transactionMock
} = vi.hoisted(() => {
  type TxMock = {
    execute: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const state = {
    user: {
      id: "user-1",
      interestMemoryText:
        "PERSONALITY:\n- Curious\n\nACTIVE_INTERESTS:\n- AI\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-"
    } as { id: string; interestMemoryText: string } | null
  };

  const transaction = vi.fn(async (callback: (tx: TxMock) => Promise<string | null>) => {
    const tx: TxMock = {
      execute: vi.fn(async () => ({
        rows: state.user
          ? [{ id: state.user.id, interest_memory_text: state.user.interestMemoryText }]
          : []
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
    reserveWebhookEventMock: vi.fn(async () => true),
    logInfoMock: vi.fn(),
    logWarnMock: vi.fn(),
    logErrorMock: vi.fn(),
    appendRecentFeedbackLinesMock: vi.fn(() => "NEXT_MEMORY"),
    dbState: state,
    transactionMock: transaction
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: transactionMock
  }
}));

vi.mock("@/lib/webhooks/inbound-idempotency", () => ({
  reserveWebhookEvent: reserveWebhookEventMock
}));

vi.mock("@/lib/memory/processors", () => ({
  appendRecentFeedbackLines: appendRecentFeedbackLinesMock
}));

vi.mock("@/lib/observability/log", () => ({
  logInfo: logInfoMock,
  logWarn: logWarnMock,
  logError: logErrorMock
}));

import { GET } from "@/app/api/feedback/click/route";
import { createFeedbackClickToken } from "@/lib/feedback/click-token";

function buildRequest(token: string): Request {
  return new Request(`http://localhost/api/feedback/click?token=${encodeURIComponent(token)}`, {
    method: "GET"
  });
}

describe("GET /api/feedback/click", () => {
  beforeEach(() => {
    process.env.FEEDBACK_LINK_SECRET = "feedback_secret";
    dbState.user = {
      id: "user-1",
      interestMemoryText:
        "PERSONALITY:\n- Curious\n\nACTIVE_INTERESTS:\n- AI\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n-"
    };

    reserveWebhookEventMock.mockReset();
    reserveWebhookEventMock.mockResolvedValue(true);
    appendRecentFeedbackLinesMock.mockReset();
    appendRecentFeedbackLinesMock.mockReturnValue("NEXT_MEMORY");
    transactionMock.mockClear();
    logInfoMock.mockClear();
    logWarnMock.mockClear();
    logErrorMock.mockClear();
  });

  it("records valid feedback clicks", async () => {
    const token = createFeedbackClickToken({
      userId: "user-1",
      url: "https://example.com/1",
      title: "Example One",
      feedbackType: "more_like_this",
      secret: "feedback_secret",
      expiresAtUnixSeconds: Math.floor(Date.now() / 1000) + 600
    });

    const response = await GET(buildRequest(token));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Got it. We will include more content like this.");
    expect(html).toContain("Continue to article");
    expect(html).toContain("https://example.com/1");
    expect(html).toContain("window.history.back()");
    expect(html).toContain("window.location.replace(returnUrl)");
    expect(reserveWebhookEventMock).toHaveBeenCalledWith("feedback_click", expect.any(String));
    expect(appendRecentFeedbackLinesMock).toHaveBeenCalledWith(
      expect.any(String),
      [expect.stringContaining("+ [more_like_this] Example One")]
    );
  });

  it("returns success no-op for duplicate clicks", async () => {
    reserveWebhookEventMock.mockResolvedValueOnce(false);

    const token = createFeedbackClickToken({
      userId: "user-1",
      url: "https://example.com/1",
      title: "Example One",
      feedbackType: "less_like_this",
      secret: "feedback_secret",
      expiresAtUnixSeconds: Math.floor(Date.now() / 1000) + 600
    });

    const response = await GET(buildRequest(token));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Feedback already recorded. Thank you.");
    expect(html).toContain("Read article anyway");
    expect(html).not.toContain("pointer: fine");
    expect(appendRecentFeedbackLinesMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens", async () => {
    const response = await GET(buildRequest("bad-token"));
    const html = await response.text();

    expect(response.status).toBe(400);
    expect(html).toContain("invalid or expired");
    expect(reserveWebhookEventMock).not.toHaveBeenCalled();
  });
});
