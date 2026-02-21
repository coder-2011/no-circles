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
    title: "Production Retrieval Fails Quietly Before Overall Quality Drops",
    url: "https://www.pinecone.io/learn/retrieval-augmented-generation/",
    summary:
      "Retrieval systems can degrade gradually while headline quality metrics still look stable. The practical lesson is to instrument retrieval itself, including recall quality and ranking behavior, rather than only scoring final answers. Teams that monitor those intermediate signals can spot drift early, fix context quality quickly, and avoid long periods of subtle user-facing errors."
  },
  {
    title: "Industrial Policy Works Best When Operational Capacity Is Built First",
    url: "https://www.oecd.org/industry/industrial-policy.htm",
    summary:
      "Industrial strategy often fails at execution, not intention. Programs tend to produce better outcomes when governments set narrower priorities, define measurable milestones, and align agencies around delivery timelines. The article emphasizes that budget size alone is not a guarantee; policy impact depends on whether institutions can coordinate implementation with enough speed and accountability."
  },
  {
    title: "Resilient Supply Chains Combine Redundancy with Decision Speed",
    url: "https://www.weforum.org/agenda/2023/01/what-is-supply-chain-resilience/",
    summary:
      "Supply-chain resilience is strongest when multiple protections work together: visibility, supplier optionality, and explicit escalation rules. Cutting every buffer for cost efficiency can make networks brittle under stress. The useful point here is balance: organizations recover faster when they pair diversification with clear operational authority to reroute, reprioritize, and communicate quickly."
  },
  {
    title: "Grid Capacity, Not Generation Targets, Is Slowing Clean-Energy Rollout",
    url: "https://www.iea.org/reports/electricity-grids-and-secure-energy-transitions",
    summary:
      "In many regions, clean-energy projects are delayed less by generation technology and more by transmission constraints. Long interconnection queues, permitting lag, and equipment lead times can stall deployment for years. The core takeaway is coordination: planning, approvals, and infrastructure procurement must be sequenced together or investment pipelines back up."
  },
  {
    title: "Housing Supply Rises Faster When Permitting Becomes Predictable",
    url: "https://www.brookings.edu/articles/how-local-governments-can-boost-housing-supply/",
    summary:
      "Cities with similar housing goals can produce very different outcomes because review and permitting pipelines move at different speeds. The article treats housing as an operations challenge: standardized requirements, clearer review windows, and fewer process bottlenecks can materially increase completion rates. Policy direction still matters, but execution rhythm determines how much gets built."
  },
  {
    title: "Protein Folding Models Are Powerful, but Biology Still Depends on Context",
    url: "https://www.nature.com/articles/d41586-024-00380-7",
    summary:
      "Structure prediction has changed how quickly researchers can reason about proteins, but static structures do not fully explain biological behavior. Function often depends on interactions, conformational dynamics, and cellular environment. The article is useful for setting expectations: model outputs are a major acceleration layer, while experimental work remains essential for causal interpretation."
  },
  {
    title: "Machiavelli on Political Durability Under Real-World Instability",
    url: "https://plato.stanford.edu/entries/machiavelli/",
    summary:
      "Machiavelli is often summarized as a strategist of power, but the deeper thread is institutional durability. Orders last when legitimacy, enforcement, and political incentives remain aligned under pressure. When one side drifts, formal structure can remain in place while practical stability weakens, which makes this a useful lens for modern governance and organizational design."
  },
  {
    title: "Debiasing Works Better as System Design Than Individual Willpower",
    url: "https://thedecisionlab.com/biases",
    summary:
      "Bias reduction is more reliable when teams redesign decision workflows instead of expecting people to self-correct in stressful moments. Structured reviews, baseline comparisons, and pre-mortems reduce repeated judgment errors. The practical value is straightforward: high-quality decisions become more repeatable when safeguards are embedded in process rather than treated as optional habits."
  },
  {
    title: "Musical Expectation Explains Why Some Information Sticks Better",
    url: "https://www.frontiersin.org/articles/10.3389/fpsyg.2013.00511/full",
    summary:
      "Music shapes attention by balancing predictability and surprise over time. Too much repetition lowers engagement, while too much novelty raises cognitive load. The article connects that balance to memory formation, offering a useful design analogy: information is retained better when structure is clear enough to follow but varied enough to sustain focus."
  },
  {
    title: "Experimentation Fails When Metrics Drift Away from Real Decisions",
    url: "https://www.gov.uk/service-manual/measuring-success/ab-testing",
    summary:
      "A/B testing programs lose value when success metrics are easy to move but weakly tied to actual product decisions. The article emphasizes hypothesis clarity, guardrail metrics, and stopping rules that protect long-term outcomes. Good experimentation is not just about statistical significance; it is about generating evidence that can guide durable product choices."
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
