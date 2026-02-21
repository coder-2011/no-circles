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

const SAMPLE_BRIEF_METADATA = {
  recipient: "Sample Reader",
  issueLabel: "Saturday, February 21, 2026",
  generatedFrom: "Diverse onboarding memory profile passed through live discovery + summary generation"
};

const SAMPLE_DAILY_BRIEF: SampleBriefItem[] = [
  {
    title: "Agentic System Black-Box Evaluation Tradeoffs",
    url: "https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-real-world-lessons-from-building-agentic-systems-at-amazon/",
    summary:
      "Agentic AI systems need evaluation beyond single-model benchmarks. Traditional methods treat agent systems as black boxes and only score final outputs. Amazon's framework adds workflow-level evaluation and library instrumentation to track tool-use accuracy, multi-step reasoning, memory retrieval, and task completion reliability."
  },
  {
    title: "State Capacity and Growth Regimes: IMF Lessons from 108 Developing Economies",
    url: "https://www.imf.org/en/publications/wp/issues/2025/01/17/state-capacity-and-growth-regimes-560288",
    summary:
      "Using data from 108 developing economies, researchers classify five-year growth regimes and model transitions with a Markov framework. Stronger state capacity helps countries sustain growth and avoid collapses, while institutional quality and democratic structure interact with those outcomes over time."
  },
  {
    title: "Sulla's Dictatorship Reforms: Temporary Fixes, Permanent Power Shift",
    url: "https://brewminate.com/elections-without-choice-how-the-roman-republic-was-lost-without-ending-the-vote/",
    summary:
      "The piece shows how the Roman Republic preserved election rituals while hollowing out competitive political constraint. Emergency rules, eligibility limits, and centralized authority maintained legal appearance but reduced real contestation, illustrating how constitutional forms can survive after substantive accountability weakens."
  },
  {
    title: "Gensler Climate-Ready Multifamily Incident Lessons",
    url: "https://www.gensler.com/publications/design-forecast/2026",
    summary:
      "Gensler's 2026 forecast highlights design priorities across regions and sectors, with emphasis on resilience, adaptation, and mixed-use urban performance. The report frames architecture decisions as operational systems questions: climate response, human movement, and long-horizon flexibility rather than standalone aesthetics."
  },
  {
    title: "2026 Federal Housing Budget Deal Postmortem",
    url: "https://ternercenter.berkeley.edu/blog/2026-federal-housing-policy-preview/",
    summary:
      "The FY 2026 U.S. housing outlook keeps key federal housing programs funded despite earlier expectations of steeper reductions. Parallel bipartisan legislative tracks continue around public housing preservation, accessory dwelling unit financing, and multifamily policy tools, signaling incremental but meaningful policy continuity."
  },
  {
    title: "Heavy-Duty Autonomous Truck Rollout Postmortem",
    url: "https://meadhunt.com/6-trends-transportation-2026/",
    summary:
      "Autonomous transport has moved from pilots into selective deployment across freight, mining, ports, and logistics corridors. Adoption remains uneven due to regulation, integration cost, and infrastructure readiness, but commercial use cases are becoming more concrete as operational benchmarks improve."
  },
  {
    title: "FMCSA Safety Measurement System Update",
    url: "https://mynatsa.org/charting-the-course-the-2026-transportation-industry-outlook/",
    summary:
      "The U.S. transport outlook for 2026 ties carrier performance to tighter safety compliance, digitized documentation, and improved cybersecurity posture. Operators face simultaneous pressure from regulation and market volatility, making operational discipline and risk management central to margin protection."
  },
  {
    title: "2026 Transportation and Logistics Trends Impacting Commercial Fleets",
    url: "https://www.assetworks.com/fleet/blog/2026-transportation-and-logistics-trends-impacting-commercial-fleets/",
    summary:
      "Fleet operators are adapting to stricter emissions standards, broader electrification pressure, and higher expectations around predictive maintenance. Regionalized supply-chain strategy and data-driven fleet operations are converging, with reliability and total-cost control becoming the primary competitive levers."
  },
  {
    title: "Transportation Trends for 2026: Technology, Sustainability, and Urban Air Mobility",
    url: "https://www.webfx.com/industries/professional-services/transportation-and-logistics/trends/",
    summary:
      "The trend brief maps telematics, electrification, MaaS, and urban air mobility as converging vectors in transport modernization. It highlights how sustainability mandates and digital infrastructure increasingly shape strategic planning, with EV adoption trajectories becoming core assumptions in fleet forecasting."
  },
  {
    title: "LLM-as-Judge Production Pipeline Benchmarks",
    url: "https://www.prompts.ai/blog/llm-evaluation-companies",
    summary:
      "A survey of LLM-evaluation platforms compares strengths across CI integration, workflow debugging, compliance monitoring, and production observability. The key operational point is that model quality alone is insufficient; evaluation infrastructure and governance discipline determine whether agentic systems stay reliable at scale."
  }
];

function resolveSiteOrigin(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl && /^https?:\/\//.test(configuredSiteUrl)) {
    return configuredSiteUrl.replace(/\/+$/, "");
  }

  return window.location.origin;
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
          <p className="text-sm uppercase tracking-[0.2em] text-[#6B775D]">Sample Daily Brief</p>
          <div className="mt-5 space-y-5 text-[#4A5641]">
            <p className="text-base leading-7">
              Daily issue for <span className="font-medium">{SAMPLE_BRIEF_METADATA.recipient}</span> •{" "}
              {SAMPLE_DAILY_BRIEF.length} curated items • {SAMPLE_BRIEF_METADATA.issueLabel}
            </p>
            <p className="text-sm leading-6 text-[#5D6A52]">{SAMPLE_BRIEF_METADATA.generatedFrom}</p>
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
            <p className="text-sm leading-6 text-[#5D6A52]">
              Reply to tune tomorrow&apos;s issue: for example, &quot;more policy implementation, less transport ops&quot;.
            </p>
          </div>
        </section>
      </div>
      <p className="pointer-events-none fixed bottom-4 right-4 text-xs font-medium text-[#6B775D]/90">
        built by Naman Chetwani
      </p>
    </main>
  );
}
