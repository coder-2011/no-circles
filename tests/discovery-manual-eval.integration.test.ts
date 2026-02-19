import { describe, expect, it, vi } from "vitest";
import { runDiscovery } from "@/lib/discovery/run-discovery";

const memory = [
  "PERSONALITY:",
  "- prefers practical, implementation-focused analysis",
  "",
  "ACTIVE_INTERESTS:",
  "- AI engineering",
  "- distributed systems",
  "- philosophy of science",
  "- macroeconomics",
  "- crypto",
  "",
  "SUPPRESSED_INTERESTS:",
  "- crypto",
  "",
  "RECENT_FEEDBACK:",
  "- less hype, more concrete tradeoffs"
].join("\n");

function buildMockExaSearch() {
  return vi.fn(async ({ query }: { query: string; numResults: number }) => {
    if (query.startsWith("AI engineering")) {
      return [
        {
          url: "https://engineering.atlassian.com/llm-evals-in-production?utm_source=x",
          title: "How teams run LLM evals in production",
          highlights: [
            "A practical walkthrough of eval harness design, regression gates, and rollout patterns for model updates."
          ],
          score: 0.79
        },
        {
          url: "https://www.anthropic.com/engineering/context-windows",
          title: "Managing long-context reliability",
          highlights: [
            "Shows concrete failure modes for long prompts and techniques for chunking, retrieval, and verification."
          ],
          score: 0.76
        },
        {
          url: "https://martinfowler.com/articles/llm-testing.html",
          title: "Testing strategy for LLM features",
          highlights: [
            "Covers deterministic checks, rubric-based review, and integration testing for non-deterministic outputs."
          ],
          score: 0.75
        }
      ];
    }

    if (query.startsWith("distributed systems")) {
      return [
        {
          url: "https://queue.acm.org/detail.cfm?id=3458812",
          title: "Idempotency patterns for distributed jobs",
          highlights: [
            "Explains idempotency keys, replay protection, and failure-retry semantics for robust background workflows."
          ],
          score: 0.72
        },
        {
          url: "https://sre.google/sre-book/monitoring-distributed-systems/",
          title: "Monitoring distributed systems",
          highlights: [
            "Details alert design, error budgets, and instrumentation approaches that reduce noisy operational decisions."
          ],
          score: 0.71
        },
        {
          url: "https://engineering.atlassian.com/llm-evals-in-production",
          title: "How teams run LLM evals in production (duplicate)",
          highlights: ["Duplicate URL to validate dedupe behavior across topics."],
          score: 0.69
        }
      ];
    }

    if (query.startsWith("philosophy of science")) {
      return [
        {
          url: "https://plato.stanford.edu/entries/scientific-method/",
          title: "Scientific method and model building",
          highlights: [
            "Surveys competing views of explanation, falsifiability, and theory revision in empirical practice."
          ],
          score: 0.67
        },
        {
          url: "https://aeon.co/essays/how-models-shape-what-we-think-is-true",
          title: "How models shape belief",
          highlights: [
            "Connects model assumptions to decision quality and the limits of quantitative certainty."
          ],
          score: 0.65
        },
        {
          url: "https://www.noemamag.com/what-predictive-models-cannot-see/",
          title: "What predictive models cannot see",
          highlights: [
            "Argues that model quality depends on institutional context and measurement choices, not just algorithmic fit."
          ],
          score: 0.64
        }
      ];
    }

    if (query.startsWith("macroeconomics")) {
      return [
        {
          url: "https://www.imf.org/en/Publications/fandd/issues/2024/03/ai-productivity",
          title: "AI and productivity: macro signals to watch",
          highlights: [
            "Breaks down labor, capital, and diffusion channels that determine whether AI gains show up in GDP data."
          ],
          score: 0.7
        },
        {
          url: "https://www.brookings.edu/articles/what-inflation-data-miss/",
          title: "What inflation dashboards miss",
          highlights: [
            "Explains second-order effects and policy-lag dynamics often ignored in simplified inflation narratives."
          ],
          score: 0.66
        }
      ];
    }

    if (query.startsWith("crypto")) {
      return [
        {
          url: "https://www.coindesk.com/markets/2026/02/10/hype-cycle-roundup/",
          title: "Crypto hype cycle roundup",
          highlights: ["High score but from suppressed topic; should be excluded from final output."],
          score: 0.99
        }
      ];
    }

    return [];
  });
}

describe("discovery manual integration eval", () => {
  it("produces a sensible final candidate set for human review", async () => {
    const exaSearch = buildMockExaSearch();

    const result = await runDiscovery(
      {
        interestMemoryText: memory,
        targetCount: 10,
        maxRetries: 2,
        maxTopics: 5,
        perTopicResults: 3
      },
      { exaSearch }
    );

    console.log("\\nMANUAL_EVAL_CANDIDATES_START");
    for (const [index, candidate] of result.candidates.entries()) {
      console.log(
        `${index + 1}. [${candidate.topic}] ${candidate.title} | ${candidate.sourceDomain} | score=${candidate.sourceScore} | ${candidate.url}`
      );
      console.log(`   highlight: ${candidate.highlight}`);
    }
    console.log(`warnings: ${JSON.stringify(result.warnings)}`);
    console.log(`attempts: ${result.attempts}`);
    console.log("MANUAL_EVAL_CANDIDATES_END\\n");

    expect(result.candidates).toHaveLength(10);
    expect(result.candidates.every((candidate) => candidate.softSuppressed === false)).toBe(true);
    expect(new Set(result.candidates.map((candidate) => candidate.topic)).size).toBeGreaterThanOrEqual(4);

    const distinctDomains = new Set(result.candidates.map((candidate) => candidate.sourceDomain));
    expect(distinctDomains.size).toBeGreaterThanOrEqual(8);

    const avgScore =
      result.candidates.reduce((sum, candidate) => sum + (candidate.sourceScore ?? 0), 0) / result.candidates.length;
    expect(avgScore).toBeGreaterThanOrEqual(0.64);

    expect(result.candidates.every((candidate) => (candidate.highlight ?? "").length >= 40)).toBe(true);
    expect(result.warnings).toContain("INSUFFICIENT_TOPIC_WINNERS");
    expect(result.warnings.some((warning) => warning.startsWith("BACKFILLED_FROM_QUALITY_POOL_"))).toBe(true);
  });
});
