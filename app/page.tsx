"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthState = "loading" | "signed_in" | "signed_out" | "error";
type SampleBriefItem = {
  title: string;
  url: string;
  summary: string;
};

type BriefLibraryItem = SampleBriefItem & {
  category: string;
  tags: string[];
};

const DEFAULT_PREVIEW_ONBOARDING_TEXT = [
  "I want deep but readable briefs across AI engineering, product strategy, economic history, biology, philosophy, design, and climate adaptation.",
  "I like implementation details, case studies, postmortems, and policy tradeoffs.",
  "Please include one or two serendipity picks in culture, cities, and science that still connect back to practical decisions."
].join(" ");

const BRIEF_LIBRARY: BriefLibraryItem[] = [
  {
    title: "How Teams Actually Evaluate AI Agents in Production",
    url: "https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-real-world-lessons-from-building-agentic-systems-at-amazon/",
    summary:
      "The piece explains why output-only benchmarks miss key failure modes in agent workflows. It outlines practical checks for tool calls, retrieval quality, step reliability, and end-to-end task completion so teams can improve systems before incidents hit users.",
    category: "ai-systems",
    tags: ["ai", "agents", "evaluation", "engineering", "production"]
  },
  {
    title: "What Strong State Capacity Changes in Growth Outcomes",
    url: "https://www.imf.org/en/publications/wp/issues/2025/01/17/state-capacity-and-growth-regimes-560288",
    summary:
      "Using cross-country data, the paper tracks how economies move between growth regimes over five-year windows. Stronger public institutions correlate with longer periods of stable growth and lower collapse risk, especially when governance quality and policy execution improve together.",
    category: "economics-policy",
    tags: ["economics", "policy", "state capacity", "history", "institutions"]
  },
  {
    title: "How the Roman Republic Kept Elections While Losing Real Competition",
    url: "https://brewminate.com/elections-without-choice-how-the-roman-republic-was-lost-without-ending-the-vote/",
    summary:
      "This history piece shows how institutional forms can survive even when accountability weakens underneath them. It traces rule changes and emergency powers that preserved electoral procedure but narrowed actual political choice.",
    category: "history-politics",
    tags: ["history", "politics", "rome", "institutions", "power"]
  },
  {
    title: "Designing Buildings for Heat, Flood, and Long-Term Flexibility",
    url: "https://www.mckinsey.com/industries/real-estate/our-insights/climate-risk-and-commercial-real-estate",
    summary:
      "The brief covers how climate risk is changing real-estate decisions from financing to retrofit priorities. It emphasizes practical adaptation moves such as heat mitigation, flood resilience, and staged upgrades that preserve asset value across changing environmental conditions.",
    category: "climate-cities",
    tags: ["climate", "architecture", "cities", "resilience", "infrastructure"]
  },
  {
    title: "What Actually Moves Housing Supply at City Scale",
    url: "https://ternercenter.berkeley.edu/blog/2026-federal-housing-policy-preview/",
    summary:
      "The piece maps federal and local policy levers that affect housing production, preservation, and financing. It focuses on incremental but meaningful tools and explains where implementation capacity, not just legislation, determines outcomes.",
    category: "economics-policy",
    tags: ["housing", "policy", "cities", "economics", "governance"]
  },
  {
    title: "Why Autonomous Freight Scales in Narrow Corridors First",
    url: "https://www.mckinsey.com/industries/automotive-and-assembly/our-insights/autonomous-trucking-in-the-united-states",
    summary:
      "Autonomous trucking adoption is progressing fastest in constrained routes with clearer economics and safety controls. The analysis explains operational bottlenecks, integration costs, and rollout sequencing rather than treating autonomy as a uniform market shift.",
    category: "transport-systems",
    tags: ["transport", "autonomy", "operations", "logistics", "systems"]
  },
  {
    title: "The New Playbook for Fleet Safety and Compliance",
    url: "https://www.fmcsa.dot.gov/safety/safety-measurement-system-sms",
    summary:
      "This update explains how fleet operators are being measured and where compliance signals translate into commercial risk. It is useful for teams that need to align dispatch, maintenance, and documentation practices with changing regulatory scrutiny.",
    category: "transport-systems",
    tags: ["transport", "safety", "policy", "operations", "compliance"]
  },
  {
    title: "Why Predictive Maintenance Wins Only with Better Operations Data",
    url: "https://www.mckinsey.com/capabilities/operations/our-insights/predictive-maintenance-3-0",
    summary:
      "Predictive maintenance delivers value when sensor data quality, failure taxonomy, and response workflows are aligned. The article focuses on implementation details that separate pilot success from durable operational gains.",
    category: "operations-data",
    tags: ["operations", "data", "maintenance", "engineering", "systems"]
  },
  {
    title: "How Cities Balance Electrification Goals with Grid Constraints",
    url: "https://www.iea.org/reports/global-ev-outlook-2024",
    summary:
      "The report connects EV adoption growth with charging infrastructure and power-system realities. It helps planners and operators reason about where electrification is scaling smoothly and where grid, permitting, or cost bottlenecks slow deployment.",
    category: "climate-cities",
    tags: ["energy", "climate", "transport", "grid", "policy"]
  },
  {
    title: "A Practical Guide to Building Better Product Experiments",
    url: "https://www.gov.uk/service-manual/measuring-success/ab-testing",
    summary:
      "The guide covers experiment design basics that prevent misleading wins: clear metrics, guardrails, and clean control groups. It is a useful operational refresher for product teams trying to improve decisions with smaller, faster tests.",
    category: "product-research",
    tags: ["product", "experiments", "decision making", "research", "analytics"]
  },
  {
    title: "How Evolution Uses Tradeoffs, Not Perfect Designs",
    url: "https://www.nature.com/scitable/topicpage/adaptation-and-natural-selection-300/",
    summary:
      "This explainer reframes adaptation as constrained optimization under changing environments. It helps connect evolutionary logic to modern systems thinking: robustness, local optima, and path dependence under limited resources.",
    category: "science-biology",
    tags: ["biology", "evolution", "science", "tradeoffs", "learning"]
  },
  {
    title: "What Cognitive Biases Distort Strategic Decisions",
    url: "https://thedecisionlab.com/biases",
    summary:
      "A practical catalog of common decision biases with concrete examples in policy and business settings. It can be used as a checklist when reviewing plans, forecasts, and postmortems to avoid repeated reasoning errors.",
    category: "psychology",
    tags: ["psychology", "decision making", "strategy", "bias", "learning"]
  },
  {
    title: "Machiavelli Beyond the Cliche: Statecraft Under Constraint",
    url: "https://plato.stanford.edu/entries/machiavelli/",
    summary:
      "Rather than caricature, this overview presents Machiavelli as a thinker focused on political durability under unstable conditions. It is useful context for readers interested in institutions, leadership, and realism in governance.",
    category: "philosophy-history",
    tags: ["philosophy", "history", "politics", "institutions", "statecraft"]
  },
  {
    title: "How Musical Structure Influences Memory and Attention",
    url: "https://www.frontiersin.org/articles/10.3389/fpsyg.2013.00511/full",
    summary:
      "The paper reviews links between musical structure and cognitive processing, including memory formation and focus. It is a serendipity pick that still ties back to learning systems and human performance design.",
    category: "culture-science",
    tags: ["music", "cognition", "science", "culture", "learning"]
  },
  {
    title: "A Better Mental Model for Supply Chain Resilience",
    url: "https://www.oecd.org/en/topics/resilience.html",
    summary:
      "This resource frames resilience as a portfolio of preparedness, flexibility, and recovery capability. It is useful for teams moving from one-off risk fixes to repeatable operating models across uncertain environments.",
    category: "operations-policy",
    tags: ["supply chain", "resilience", "operations", "policy", "risk"]
  }
];

function tokenizeOnboardingText(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

function buildPreviewBriefFromOnboardingText(text: string, targetCount = 10): SampleBriefItem[] {
  const tokens = tokenizeOnboardingText(text);
  const scored = BRIEF_LIBRARY.map((item, index) => {
    const searchBlob = `${item.title} ${item.summary} ${item.tags.join(" ")}`.toLowerCase();
    const matchCount = item.tags.reduce((count, tag) => count + (tokens.has(tag.toLowerCase()) ? 1 : 0), 0);
    const keywordBonus = [...tokens].some((token) => searchBlob.includes(token)) ? 1 : 0;

    return {
      item,
      score: matchCount * 3 + keywordBonus,
      index
    };
  }).sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score));

  const categoryCounts = new Map<string, number>();
  const selected: SampleBriefItem[] = [];

  for (const entry of scored) {
    if (selected.length >= targetCount) break;
    const currentCategoryCount = categoryCounts.get(entry.item.category) ?? 0;
    if (currentCategoryCount >= 2) continue;
    selected.push({
      title: entry.item.title,
      url: entry.item.url,
      summary: entry.item.summary
    });
    categoryCounts.set(entry.item.category, currentCategoryCount + 1);
  }

  if (selected.length < targetCount) {
    for (const entry of scored) {
      if (selected.length >= targetCount) break;
      const exists = selected.some((item) => item.url === entry.item.url);
      if (exists) continue;
      selected.push({
        title: entry.item.title,
        url: entry.item.url,
        summary: entry.item.summary
      });
    }
  }

  return selected;
}

const SAMPLE_DAILY_BRIEF: SampleBriefItem[] = buildPreviewBriefFromOnboardingText(DEFAULT_PREVIEW_ONBOARDING_TEXT);

function resolveSiteOrigin(): string {
  const browserOrigin = window.location.origin;
  const browserHost = window.location.hostname.toLowerCase();
  const isLocalHost = browserHost === "localhost" || browserHost === "127.0.0.1" || browserHost === "::1";
  if (isLocalHost) {
    return browserOrigin;
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl && /^https?:\/\//.test(configuredSiteUrl)) {
    return configuredSiteUrl.replace(/\/+$/, "");
  }

  return browserOrigin;
}

function getAuthQueryErrorMessage(): string | null {
  const authCode = new URLSearchParams(window.location.search).get("auth");
  if (!authCode) return null;

  if (authCode === "required") {
    return "Please sign in to continue.";
  }
  if (authCode === "oauth_code_missing") {
    return "Sign-in callback was incomplete. Please try again.";
  }
  if (authCode === "oauth_error") {
    return "Sign-in failed. Please try again.";
  }

  return "Authentication failed. Please try again.";
}

export default function HomePage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authClient] = useState<{ supabase: SupabaseClient | null; initError: string | null }>(() => {
    try {
      return { supabase: getBrowserSupabaseClient(), initError: null };
    } catch {
      return {
        supabase: null,
        initError: "Auth client is not configured. Add Supabase env vars."
      };
    }
  });

  const supabase = authClient.supabase;

  useEffect(() => {
    if (!authClient.initError) {
      return;
    }

    setAuthState("error");
    setAuthError(authClient.initError);
  }, [authClient.initError]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    if (!code) {
      return;
    }

    const nextParam = searchParams.get("next");
    const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : "/onboarding";
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("next", nextPath);
    router.replace(callbackUrl.pathname + callbackUrl.search);
  }, [router]);

  useEffect(() => {
    const queryError = getAuthQueryErrorMessage();
    if (!queryError) {
      return;
    }

    setAuthError(queryError);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setAuthState("error");
        setAuthError(error.message);
        return;
      }

      const sessionEmail = data.session?.user?.email;
      if (sessionEmail) {
        setEmail(sessionEmail);
        setAuthState("signed_in");
      } else {
        setAuthState("signed_out");
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setAuthState("signed_in");
        return;
      }

      setEmail(null);
      setAuthState("signed_out");
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (authState !== "signed_in") {
      return;
    }

    if (!window.location.search.includes("auth=")) {
      return;
    }

    setAuthError(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, [authState]);

  async function signInWithGoogle() {
    if (authState === "signed_in") {
      router.replace("/onboarding");
      return;
    }

    if (!supabase) return;

    setAuthError(null);
    const redirectTo = `${resolveSiteOrigin()}/auth/callback?next=/onboarding`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error) {
      setAuthError(error.message);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setAuthError(error.message);
      return;
    }

    router.replace("/");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F3ECD8] px-6 py-14 text-[#2D3426] md:px-10 md:py-20" id="top">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(61,111,73,0.14),transparent_40%),radial-gradient(circle_at_82%_8%,rgba(198,182,137,0.24),transparent_36%),radial-gradient(circle_at_70%_86%,rgba(93,131,89,0.12),transparent_40%)]" />
      <div className="relative mx-auto w-full max-w-7xl space-y-10">
        <section className="rounded-3xl border border-[#C9BD9A] bg-[#F8F3E4] p-8 shadow-sm md:p-10">
          <h1 className="text-5xl font-semibold leading-tight text-[#2B3125] md:text-6xl">No Circles</h1>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-lg border border-[#3D6F49] bg-[#3D6F49] px-5 py-3 text-base font-medium text-[#F3ECD8] transition hover:bg-[#315E3E] disabled:opacity-60"
              disabled={authState === "loading"}
              onClick={signInWithGoogle}
              type="button"
            >
              Get started
            </button>
            {authState === "signed_in" ? (
              <button
                className="rounded-lg border border-[#A49671] bg-[#EFE7D0] px-5 py-3 text-base font-medium text-[#374230] transition hover:bg-[#E5DCC3]"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            ) : null}
          </div>
          <p className="mt-4 text-lg font-medium text-[#526149]">
            {authState === "signed_in" && email ? `Signed in as ${email}` : "Sign in to save onboarding securely."}
          </p>
          {authError ? <p className="mt-3 text-base text-rose-700">{authError}</p> : null}
        </section>

        <section className="rounded-3xl border border-[#C9BD9A] bg-[#FBF7EB] p-8 text-[#2D3426] shadow-sm md:p-10">
          <h2 className="text-2xl font-semibold leading-tight text-[#2D3426] md:text-3xl">Sample Daily Brief</h2>
          <div className="mt-5 space-y-5 text-[#4A5641]">
            <ol className="space-y-5">
              {SAMPLE_DAILY_BRIEF.map((item, index) => (
                <li className="rounded-xl border border-[#D8CFB4] bg-[#F7F2E2] p-4" key={item.url}>
                  <a
                    className="text-base font-semibold leading-6 text-[#2D3426] underline decoration-[#8B9A7A] decoration-2 underline-offset-4 hover:text-[#1E2519]"
                    href={item.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {index + 1}. {item.title}
                  </a>
                  <p className="mt-2 text-sm leading-6 text-[#4A5641]">{item.summary}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
      <p className="pointer-events-none fixed bottom-4 right-4 text-xs font-medium text-[#6B775D]/90">
        built by Naman Chetwani
      </p>
    </main>
  );
}
