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

const SAMPLE_DAILY_BRIEF: SampleBriefItem[] = [
  {
    title: "How Teams Actually Evaluate AI Agents in Production",
    url: "https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-real-world-lessons-from-building-agentic-systems-at-amazon/",
    summary:
      "Output-only evals hide where agent systems actually fail. Reliable evaluation tracks tool-call accuracy, retrieval quality, step-by-step execution, and final task success under realistic workloads. The article also emphasizes operational checks such as replay tests, trace inspection, and failure clustering so teams can catch regressions early, not after deployment, and improve both model behavior and orchestration logic."
  },
  {
    title: "What Strong State Capacity Changes in Growth Outcomes",
    url: "https://www.imf.org/en/publications/wp/issues/2025/01/17/state-capacity-and-growth-regimes-560288",
    summary:
      "Across many countries, growth tends to move in regimes rather than smooth trends. Stronger administrative capacity helps states sustain expansions and recover faster from shocks because policies are implemented more consistently. The paper links growth durability to execution quality, not only policy design, and shows how weak institutions increase transition risk from stable growth into stagnation or contraction."
  },
  {
    title: "How the Roman Republic Kept Elections While Losing Real Competition",
    url: "https://brewminate.com/elections-without-choice-how-the-roman-republic-was-lost-without-ending-the-vote/",
    summary:
      "Roman political institutions kept formal voting procedures while substantive competition narrowed over time. Emergency powers, eligibility constraints, and concentrated command shifted real decision authority away from open contestation. The article is useful as an institutional warning: procedural continuity can mask structural power changes, so constitutional health depends on enforcement balance, elite incentives, and credible checks, not ritual alone."
  },
  {
    title: "Designing Buildings for Heat, Flood, and Long-Term Flexibility",
    url: "https://www.mckinsey.com/industries/real-estate/our-insights/climate-risk-and-commercial-real-estate",
    summary:
      "Climate risk is moving from compliance reporting into core asset strategy. Heat stress, flood exposure, insurance repricing, and retrofit economics now shape acquisition and renovation decisions. The piece explains staged adaptation moves that protect both operations and long-horizon value, including envelope upgrades, cooling resilience, water defenses, and flexible design choices that keep buildings usable under changing environmental baselines."
  },
  {
    title: "What Actually Moves Housing Supply at City Scale",
    url: "https://ternercenter.berkeley.edu/blog/2026-federal-housing-policy-preview/",
    summary:
      "Housing output depends on a chain, not one policy lever: zoning path, permitting speed, financing terms, and project risk. The article maps where federal tools help and where local execution still bottlenecks supply. Its key idea is implementation capacity: predictable timelines, administrative throughput, and financing clarity often matter as much as headline legislation for getting units built and preserved."
  },
  {
    title: "Why Autonomous Freight Scales in Narrow Corridors First",
    url: "https://www.mckinsey.com/industries/automotive-and-assembly/our-insights/autonomous-trucking-in-the-united-states",
    summary:
      "Commercial autonomy is scaling first where route structure, weather profile, and handoff logistics are tightly controlled. That operating envelope reduces uncertainty in safety validation and unit economics. The analysis highlights integration realities such as depot workflows, remote assistance, and mixed-fleet transition costs, showing why rollout sequencing is a systems problem rather than a single-model performance milestone."
  },
  {
    title: "The New Playbook for Fleet Safety and Compliance",
    url: "https://www.fmcsa.dot.gov/safety/safety-measurement-system-sms",
    summary:
      "Safety scoring now has direct operational and financial consequences for carriers. The update clarifies which behaviors and records drive risk signals, and how documentation quality interacts with enforcement outcomes. Practically, it pushes tighter alignment across dispatch, maintenance, driver coaching, and audit readiness so compliance becomes a daily operating discipline instead of a periodic legal check."
  },
  {
    title: "How Evolution Uses Tradeoffs, Not Perfect Designs",
    url: "https://www.nature.com/scitable/topicpage/adaptation-and-natural-selection-300/",
    summary:
      "Natural selection optimizes fitness in local environments, not universal perfection. Traits that improve one function can impose costs elsewhere, creating durable tradeoffs across energy, resilience, and reproduction. The article uses these constraints to explain why biological systems settle into path-dependent, good-enough designs. It is a strong mental model for engineering and policy: optimization always happens under limits, not ideal conditions."
  },
  {
    title: "Machiavelli Beyond the Cliche: Statecraft Under Constraint",
    url: "https://plato.stanford.edu/entries/machiavelli/",
    summary:
      "Machiavelli is often reduced to manipulation advice, but the deeper thread is institutional durability under unstable conditions. The entry outlines tensions between civic virtue, coercive capacity, and contingency in state survival. It helps frame leadership as a constraint-management problem: preserving order and legitimacy when incentives, elite conflict, and external threats make clean moral or procedural solutions difficult."
  },
  {
    title: "How Musical Structure Influences Memory and Attention",
    url: "https://www.frontiersin.org/articles/10.3389/fpsyg.2013.00511/full",
    summary:
      "Musical form affects prediction, attention, and memory encoding through repetition, variation, and expectation violation. The paper reviews mechanisms linking structural features to cognitive load and recall performance. Beyond music theory, the takeaway is broadly useful: information design that balances familiarity with surprise can improve retention and engagement without relying on noise or novelty for its own sake."
  }
];

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
