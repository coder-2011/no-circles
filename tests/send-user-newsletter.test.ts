import { describe, expect, it, vi } from "vitest";
import type { DiscoveryRunResult } from "@/lib/discovery/types";
import { mightContainCanonicalUrl } from "@/lib/bloom/user-url-bloom";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn()
  }
}));

import { sendUserNewsletter } from "@/lib/pipeline/send-user-newsletter";

function makeDiscoveryResult(urls: string[]): DiscoveryRunResult {
  return {
    candidates: urls.map((url, index) => ({
      url,
      canonicalUrl: url,
      title: `Title ${index + 1}`,
      highlight: `Highlight ${index + 1}`,
      highlights: [`Highlight ${index + 1}`],
      topic: `topic-${index + 1}`,
      topicRank: index,
      softSuppressed: false,
      resultRank: 0,
      sourceDomain: "example.com",
      publishedAt: null,
      exaScore: 0.8,
      highlightScore: 0.7,
      highlightScores: [0.7]
    })),
    topics: [],
    serendipityTopics: ["topic-9", "topic-10"],
    attempts: 1,
    warnings: [],
    diversityCard: {
      itemCount: urls.length,
      targetCount: urls.length,
      distinctTopics: urls.length,
      distinctDomains: 1,
      maxTopicShare: 0.1,
      maxDomainShare: 1,
      topicEntropyNormalized: 1,
      thresholds: {
        minDistinctTopics: 6,
        maxTopicShare: 0.3,
        minDistinctDomains: 6,
        maxDomainShare: 0.3
      },
      passes: true
    }
  };
}

const user = {
  id: "user-1",
  email: "user@example.com",
  preferredName: "Naman",
  timezone: "UTC",
  interestMemoryText: "PERSONALITY:\n- practical\n\nACTIVE_INTERESTS:\n- ai\n\nSUPPRESSED_INTERESTS:\n-\n\nRECENT_FEEDBACK:\n- use evidence",
  sentUrlBloomBits: null
};

const selectedQuote = {
  text: "Stay close to concrete evidence and update your map when reality changes.",
  author: "No Circles",
  category: "learning",
  sourceDataset: "jstet/quotes-500k",
  rowIndex: 42
};

const getFinalHighlightsByUrlFn = async (args: { urls: string[] }) => {
  return new Map(args.urls.map((url) => [url, [`Highlight for ${url}`]]));
};

describe("sendUserNewsletter", () => {
  it("sends exactly 10 items and persists bloom state on success", async () => {
    const runDiscoveryFn = vi.fn(async () => {
      return makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`));
    });

    const generateSummariesFn = vi.fn(async ({ items }: { items: Array<{ url: string; title: string; highlights: string[] }> }) => {
      return items.map((item) => ({ title: item.title, summary: "summary", url: item.url }));
    });

    const sendNewsletterFn = vi.fn(async () => ({ ok: true, providerMessageId: "msg_1", attempts: 1, error: null }));
    const markIdempotencyFailedFn = vi.fn(async () => undefined);
    const persistSendSuccessFn = vi.fn(async () => undefined);
    const selectQuoteFn = vi.fn(async () => selectedQuote);
    const renderNewsletterFn = vi.fn(() => ({
      subject: "Daily",
      html: "<p>daily</p>",
      text: "daily"
    }));

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn,
        getFinalHighlightsByUrlFn,
        generateSummariesFn,
        selectQuoteFn,
        renderNewsletterFn,
        selectThemeTemplateFn: () => "07-merlot-ink",
        sendNewsletterFn,
        reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null }),
        markIdempotencyFailedFn,
        persistSendSuccessFn
      }
    );

    expect(result.status).toBe("sent");
    expect(generateSummariesFn).toHaveBeenCalledTimes(1);
    const summaryInputItems = generateSummariesFn.mock.calls[0]?.[0]?.items;
    expect(summaryInputItems?.[8]?.isSerendipitous).toBe(true);
    expect(summaryInputItems?.[9]?.isSerendipitous).toBe(true);
    expect(summaryInputItems?.[0]?.isSerendipitous).toBe(false);
    expect(sendNewsletterFn).toHaveBeenCalledTimes(1);
    expect(renderNewsletterFn).toHaveBeenCalledWith(
      expect.objectContaining({
        themeTemplate: "07-merlot-ink"
      })
    );
    expect(selectQuoteFn).toHaveBeenCalledTimes(1);
    expect(markIdempotencyFailedFn).not.toHaveBeenCalled();
    expect(persistSendSuccessFn).toHaveBeenCalledTimes(1);

    const persisted = persistSendSuccessFn.mock.calls[0]?.[0];
    expect(persisted.bloomState.count).toBe(10);
    expect(mightContainCanonicalUrl(persisted.bloomState, "https://example.com/1")).toBe(true);
  });

  it("returns insufficient_content when discovery cannot produce enough items", async () => {
    const runDiscoveryFn = vi.fn(async () => {
      throw new Error("INSUFFICIENT_QUALITY_CANDIDATES:6/10");
    });

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn
      }
    );

    expect(result.status).toBe("insufficient_content");
  });

  it("marks failed and returns send_failed when provider fails twice", async () => {
    const markIdempotencyFailedFn = vi.fn(async () => undefined);
    const selectQuoteFn = vi.fn(async () => selectedQuote);

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn,
        generateSummariesFn: async ({ items }) => items.map((item) => ({ title: item.title, summary: "summary", url: item.url })),
        selectQuoteFn,
        sendNewsletterFn: async () => ({ ok: false, providerMessageId: null, attempts: 2, error: "provider down" }),
        reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null }),
        markIdempotencyFailedFn
      }
    );

    expect(result.status).toBe("send_failed");
    expect(markIdempotencyFailedFn).toHaveBeenCalledTimes(1);
  });

  it("marks failed when send function throws after idempotency reservation", async () => {
    const markIdempotencyFailedFn = vi.fn(async () => undefined);
    const selectQuoteFn = vi.fn(async () => selectedQuote);

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn,
        generateSummariesFn: async ({ items }) => items.map((item) => ({ title: item.title, summary: "summary", url: item.url })),
        selectQuoteFn,
        reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null }),
        markIdempotencyFailedFn,
        sendNewsletterFn: async () => {
          throw new Error("MISSING_RESEND_FROM_EMAIL");
        }
      }
    );

    expect(result.status).toBe("send_failed");
    expect(result.error).toBe("MISSING_RESEND_FROM_EMAIL");
    expect(markIdempotencyFailedFn).toHaveBeenCalledTimes(1);
  });

  it("returns sent when post-send user-state persistence fails after idempotency is marked sent", async () => {
    const markIdempotencyFailedFn = vi.fn(async () => undefined);
    const markIdempotencySentFn = vi.fn(async () => undefined);
    const selectQuoteFn = vi.fn(async () => selectedQuote);

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn,
        generateSummariesFn: async ({ items }) => items.map((item) => ({ title: item.title, summary: "summary", url: item.url })),
        selectQuoteFn,
        reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null }),
        markIdempotencySentFn,
        markIdempotencyFailedFn,
        sendNewsletterFn: async () => ({ ok: true, providerMessageId: "msg_post_send", attempts: 1, error: null }),
        persistSendSuccessFn: async () => {
          throw new Error("USERS_UPDATE_FAILED");
        }
      }
    );

    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("msg_post_send");
    expect(result.error).toContain("POST_SEND_USER_STATE_UPDATE_FAILED");
    expect(markIdempotencySentFn).toHaveBeenCalledTimes(1);
    expect(markIdempotencyFailedFn).not.toHaveBeenCalled();
  });

  it("returns sent without duplicate send only when existing idempotency row is already sent", async () => {
    const sendNewsletterFn = vi.fn();

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn,
        reserveIdempotencyFn: async () => ({ outcome: "already_sent", status: "sent", providerMessageId: "msg_existing" }),
        sendNewsletterFn
      }
    );

    expect(result.status).toBe("sent");
    expect(result.itemCount).toBe(0);
    expect(result.providerMessageId).toBe("msg_existing");
    expect(sendNewsletterFn).not.toHaveBeenCalled();
  });

  it("returns send_failed when idempotency conflict is still processing", async () => {
    const sendNewsletterFn = vi.fn();

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn,
        reserveIdempotencyFn: async () => ({ outcome: "already_processing", status: "processing", providerMessageId: null }),
        sendNewsletterFn
      }
    );

    expect(result.status).toBe("send_failed");
    expect(result.error).toBe("IDEMPOTENCY_ALREADY_PROCESSING");
    expect(sendNewsletterFn).not.toHaveBeenCalled();
  });

  it("proceeds with send when failed idempotency row is reclaimed", async () => {
    const sendNewsletterFn = vi.fn(async () => ({ ok: true, providerMessageId: "msg_retry", attempts: 1, error: null }));
    const selectQuoteFn = vi.fn(async () => selectedQuote);

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn,
        generateSummariesFn: async ({ items }) => items.map((item) => ({ title: item.title, summary: "summary", url: item.url })),
        selectQuoteFn,
        reserveIdempotencyFn: async () => ({ outcome: "retryable_failed_claimed", status: "processing", providerMessageId: null }),
        persistSendSuccessFn: async () => undefined,
        sendNewsletterFn
      }
    );

    expect(result.status).toBe("sent");
    expect(sendNewsletterFn).toHaveBeenCalledTimes(1);
  });

  it("returns insufficient_content when final Exa highlights are missing", async () => {
    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn: async () => new Map(),
        reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null })
      }
    );

    expect(result.status).toBe("insufficient_content");
    expect(result.error).toBe("INSUFFICIENT_EXA_HIGHLIGHTS");
  });

  it("drops entries with missing highlights and still sends remaining items", async () => {
    const renderNewsletterFn = vi.fn(() => ({
      subject: "Daily",
      html: "<p>daily</p>",
      text: "daily"
    }));

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z")
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 10 }).map((_, index) => `https://example.com/${index + 1}`)),
        getFinalHighlightsByUrlFn: async () =>
          new Map(
            Array.from({ length: 8 }).map((_, index) => {
              const url = `https://example.com/${index + 1}`;
              return [url, [`Highlight for ${url}`]];
            })
          ),
        generateSummariesFn: async ({ items }) => items.map((item) => ({ title: item.title, summary: "summary", url: item.url })),
        selectQuoteFn: async () => selectedQuote,
        reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null }),
        renderNewsletterFn,
        sendNewsletterFn: async () => ({ ok: true, providerMessageId: "msg_partial", attempts: 1, error: null }),
        persistSendSuccessFn: async () => undefined
      }
    );

    expect(result.status).toBe("sent");
    expect(result.itemCount).toBe(8);
    expect(renderNewsletterFn).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ url: "https://example.com/1" }),
          expect.objectContaining({ url: "https://example.com/8" })
        ])
      })
    );
  });

  it("supports welcome variant with configurable target item count", async () => {
    const renderNewsletterFn = vi.fn(() => ({
      subject: "Welcome to No Circles - your first issue",
      html: "<p>welcome</p>",
      text: "welcome"
    }));

    const result = await sendUserNewsletter(
      {
        userId: user.id,
        runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
        targetItemCount: 5,
        issueVariant: "welcome"
      },
      {
        loadUserFn: async () => user,
        runDiscoveryFn: async () =>
          makeDiscoveryResult(Array.from({ length: 5 }).map((_, index) => `https://example.com/welcome-${index + 1}`)),
        getFinalHighlightsByUrlFn,
        generateSummariesFn: async ({ items }) => items.map((item) => ({ title: item.title, summary: "summary", url: item.url })),
        selectQuoteFn: async () => selectedQuote,
        reserveIdempotencyFn: async () => ({ outcome: "claimed", status: "processing", providerMessageId: null }),
        renderNewsletterFn,
        selectThemeTemplateFn: () => "10-mint-fig",
        sendNewsletterFn: async () => ({ ok: true, providerMessageId: "msg_welcome", attempts: 1, error: null }),
        persistSendSuccessFn: async () => undefined
      }
    );

    expect(result.status).toBe("sent");
    expect(result.itemCount).toBe(5);
    expect(renderNewsletterFn).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "welcome",
        themeTemplate: "10-mint-fig",
        items: expect.any(Array)
      })
    );
  });
});
