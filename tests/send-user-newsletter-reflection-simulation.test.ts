import { describe, expect, it, vi } from "vitest";
import { encodeBloomBitsBase64 } from "@/lib/bloom/user-url-bloom";
import type { DiscoveryBrief, DiscoveryRunResult } from "@/lib/discovery/types";
import type { RecentEmailRecord } from "@/lib/memory/email-history";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
    update: vi.fn()
  }
}));

import { sendUserNewsletter } from "@/lib/pipeline/send-user-newsletter";

function makeDiscoveryResult(runLabel: string): DiscoveryRunResult {
  return {
    candidates: Array.from({ length: 10 }).map((_, index) => {
      const url = `https://example.com/${runLabel}/${index + 1}`;
      return {
        url,
        canonicalUrl: url,
        title: `${runLabel} title ${index + 1}`,
        highlight: `${runLabel} highlight ${index + 1}`,
        highlights: [`${runLabel} highlight ${index + 1}`],
        topic: `topic-${index + 1}`,
        topicRank: index,
        softSuppressed: false,
        resultRank: 0,
        sourceDomain: "example.com",
        publishedAt: null,
        exaScore: 0.9,
        highlightScore: 0.8,
        highlightScores: [0.8]
      };
    }),
    topics: [],
    serendipityTopics: ["topic-9", "topic-10"],
    attempts: 1,
    warnings: [],
    diversityCard: {
      itemCount: 10,
      targetCount: 10,
      distinctTopics: 10,
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

const initialMemory = [
  "PERSONALITY:",
  "- likes concrete explanations",
  "",
  "ACTIVE_INTERESTS:",
  "- ai infrastructure",
  "- industrial policy",
  "",
  "RECENT_FEEDBACK:",
  "- wants grounded analysis"
].join("\n");

const rewrittenMemory = [
  "PERSONALITY:",
  "- likes concrete explanations",
  "- prefers implementation detail over trend framing",
  "",
  "ACTIVE_INTERESTS:",
  "- ai infrastructure",
  "- industrial policy",
  "- science of reading",
  "",
  "RECENT_FEEDBACK:",
  "- wants grounded analysis",
  "- recently curious about reading and learning tools"
].join("\n");

const dayOneBrief: DiscoveryBrief = {
  reinforceTopics: ["science of reading"],
  avoidPatterns: ["generic future-of-ai essays"],
  preferredAngles: ["implementation constraints"],
  noveltyMoves: ["adjacent learning-science angle"]
};

const dayThreeBrief: DiscoveryBrief = {
  reinforceTopics: ["industrial policy"],
  avoidPatterns: ["repeat the day-2 framing"],
  preferredAngles: ["institutional consequences"],
  noveltyMoves: ["history-of-technology parallel"]
};

const selectedQuote = {
  text: "Treat curiosity as something to guide, not just something to mirror.",
  author: "No Circles",
  category: "learning",
  sourceDataset: "jstet/quotes-500k",
  rowIndex: 7
};

describe("sendUserNewsletter bi-daily reflection simulation", () => {
  it("simulates a three-send timeline and captures how reflection affects downstream discovery", async () => {
    const mutableUser = {
      id: "user-reflection-sim",
      email: "reader@example.com",
      preferredName: "Reader",
      timezone: "UTC",
      interestMemoryText: initialMemory,
      lastReflectionAt: null as Date | null,
      sentUrlBloomBits: null as string | null
    };

    const recentReplyEmails: RecentEmailRecord[] = [
      {
        createdAt: "2026-02-15T09:00:00.000Z",
        subject: "Re: No Circles",
        bodyText: "More things that help me understand how people learn. Less generic AI futurism.",
        providerMessageId: "reply-1",
        issueVariant: null
      }
    ];
    const recentSentEmails: RecentEmailRecord[] = [];

    const reflectionCalls: Array<{
      runAtUtc: string;
      currentMemoryText: string;
      recentSentEmails: RecentEmailRecord[];
      recentReplyEmails: RecentEmailRecord[];
    }> = [];
    const discoveryCalls: Array<{
      runAtUtc: string;
      interestMemoryText: string;
      discoveryBrief: DiscoveryBrief | undefined;
    }> = [];

    let activeRunAtIso = "";
    let discoveryRunCount = 0;
    let reflectionRunCount = 0;

    const runDiscoveryFn = vi.fn(async (input: { interestMemoryText: string; discoveryBrief?: DiscoveryBrief }) => {
      discoveryRunCount += 1;
      discoveryCalls.push({
        runAtUtc: activeRunAtIso,
        interestMemoryText: input.interestMemoryText,
        discoveryBrief: input.discoveryBrief
      });

      return makeDiscoveryResult(`day-${discoveryRunCount}`);
    });

    const runBiDailyReflectionFn = vi.fn(
      async (args: {
        runAtUtc: Date;
        currentMemoryText: string;
        recentSentEmails: RecentEmailRecord[];
        recentReplyEmails: RecentEmailRecord[];
      }) => {
        reflectionRunCount += 1;
        reflectionCalls.push({
          runAtUtc: args.runAtUtc.toISOString(),
          currentMemoryText: args.currentMemoryText,
          recentSentEmails: [...args.recentSentEmails],
          recentReplyEmails: [...args.recentReplyEmails]
        });

        if (reflectionRunCount === 1) {
          return {
            reviewedAt: args.runAtUtc,
            decision: "rewrite" as const,
            memoryText: rewrittenMemory,
            discoveryBrief: dayOneBrief
          };
        }

        return {
          reviewedAt: args.runAtUtc,
          decision: "no_change" as const,
          memoryText: args.currentMemoryText,
          discoveryBrief: dayThreeBrief
        };
      }
    );

    const renderNewsletterFn = vi.fn(
      (args: { items: Array<{ title: string; summary: string }>; variant: "daily" | "welcome" }) => ({
        subject: `${args.variant} issue`,
        html: "<p>newsletter</p>",
        text: args.items.map((item) => `${item.title}: ${item.summary}`).join("\n")
      })
    );

    const runOnce = async (runAtUtc: Date) => {
      activeRunAtIso = runAtUtc.toISOString();

      return sendUserNewsletter(
        {
          userId: mutableUser.id,
          runAtUtc
        },
        {
          loadUserFn: async () => ({ ...mutableUser }),
          loadRecentEmailHistoryFn: async () => ({
            recentSentEmails: [...recentSentEmails],
            recentReplyEmails: [...recentReplyEmails]
          }),
          runBiDailyReflectionFn,
          runDiscoveryFn,
          getFinalHighlightsByUrlFn: async ({ urls }) => new Map(urls.map((url) => [url, [`Highlight for ${url}`]])),
          generateSummariesFn: async ({ items }) =>
            items.map((item) => ({
              title: item.title,
              summary: "summary",
              url: item.url
            })),
          selectQuoteFn: async () => selectedQuote,
          renderNewsletterFn,
          sendNewsletterFn: async () => ({
            ok: true,
            providerMessageId: `msg-${activeRunAtIso}`,
            attempts: 1,
            error: null
          }),
          reserveIdempotencyFn: async () => ({
            outcome: "claimed",
            status: "processing",
            providerMessageId: null
          }),
          markIdempotencySentFn: async () => undefined,
          markIdempotencyFailedFn: async () => undefined,
          persistReflectionResultFn: async ({ reviewedAt, memoryText }) => {
            mutableUser.lastReflectionAt = reviewedAt;
            if (memoryText) {
              mutableUser.interestMemoryText = memoryText;
            }
          },
          persistSendSuccessFn: async ({ bloomState }) => {
            mutableUser.sentUrlBloomBits = encodeBloomBitsBase64(bloomState);
          },
          recordSentEmailHistoryFn: async ({ kind, bodyText, subject, providerMessageId, issueVariant }) => {
            if (kind !== "sent") {
              return;
            }

            recentSentEmails.unshift({
              createdAt: activeRunAtIso,
              subject: subject ?? null,
              bodyText,
              providerMessageId: providerMessageId ?? null,
              issueVariant: issueVariant ?? null
            });
            recentSentEmails.splice(5);
          }
        }
      );
    };

    const dayOne = await runOnce(new Date("2026-02-16T10:00:00.000Z"));
    const dayTwo = await runOnce(new Date("2026-02-17T10:00:00.000Z"));
    const dayThree = await runOnce(new Date("2026-02-18T10:00:00.000Z"));

    expect(dayOne.status).toBe("sent");
    expect(dayTwo.status).toBe("sent");
    expect(dayThree.status).toBe("sent");

    expect(reflectionCalls).toHaveLength(2);
    expect(reflectionCalls[0]?.currentMemoryText).toBe(initialMemory);
    expect(reflectionCalls[0]?.recentSentEmails).toEqual([]);
    expect(reflectionCalls[0]?.recentReplyEmails).toHaveLength(1);

    expect(discoveryCalls).toHaveLength(3);
    expect(discoveryCalls[0]).toEqual({
      runAtUtc: "2026-02-16T10:00:00.000Z",
      interestMemoryText: rewrittenMemory,
      discoveryBrief: dayOneBrief
    });
    expect(discoveryCalls[1]).toEqual({
      runAtUtc: "2026-02-17T10:00:00.000Z",
      interestMemoryText: rewrittenMemory,
      discoveryBrief: undefined
    });
    expect(discoveryCalls[2]).toEqual({
      runAtUtc: "2026-02-18T10:00:00.000Z",
      interestMemoryText: rewrittenMemory,
      discoveryBrief: dayThreeBrief
    });

    expect(reflectionCalls[1]?.recentSentEmails).toHaveLength(2);
    expect(reflectionCalls[1]?.recentSentEmails[0]?.bodyText).toContain("day-2 title 1");
    expect(reflectionCalls[1]?.recentSentEmails[1]?.bodyText).toContain("day-1 title 1");
    expect(reflectionCalls[1]?.recentReplyEmails[0]?.bodyText).toContain("how people learn");
    expect(mutableUser.lastReflectionAt?.toISOString()).toBe("2026-02-18T10:00:00.000Z");
    expect(mutableUser.interestMemoryText).toBe(rewrittenMemory);
  });
});
