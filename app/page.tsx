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
    title: "How Agentic AI Will Reshape Engineering Workflows in 2026",
    url: "https://www.cio.com/article/4134741/how-agentic-ai-will-reshape-engineering-workflows-in-2026.html",
    summary:
      "Agentic AI systems that reason, plan and execute multi-step goals autonomously will fundamentally reshape engineering teams in 2026, moving beyond AI as a coding assistant to autonomous execution of entire software development lifecycle segments. Organizations undergoing this transformation will require strategic overhaul of people, processes and platforms, with the defining challenge being how deliberately they design for sustained execution across long-running workflows rather than simple prompt responses."
  },
  {
    title: "Cline Agent Migration Postmortem",
    url: "https://cline.bot/blog/migrating-production-agent-failures-20260210",
    summary:
      "The requested blog post about Cline Agent migration is not available. The page indicates the post does not exist or has been moved. It highlights the main development, the practical implications, and the key tradeoffs for this topic, while connecting the evidence to practical decisions."
  },
  {
    title: "Software Architecture and Design Trends Report - 2025",
    url: "https://www.infoq.com/articles/architecture-trends-2025/",
    summary:
      "As large language models have become widely adopted, AI-related innovation is focusing on finely-tuned small language models and agentic AI. Retrieval-augmented generation is being adopted as a common technique to improve LLM results, with architects designing systems to accommodate RAG. Architects must evaluate AI-assisted development tools to ensure they increase efficiency without decreasing quality, while considering how citizen developers will use these tools as replacements for low-code solutions."
  },
  {
    title: "Data Engineering for Agent-Native Workloads: Reliability and Infrastructure Shifts in 2026",
    url: "https://gradientflow.substack.com/p/data-engineering-for-machine-users",
    summary:
      "Data engineering faces competing pressures as agentic workloads become dominant: automation increases while decision-making by software demands greater scrutiny. Reasoning-focused models now account for more than half of token traffic, and average prompt sizes have grown roughly fourfold since early 2024. Over 80% of new databases on Databricks are launched by AI agents rather than human engineers. The traditional stack optimized for tabular data, dashboards, batch ETL, and human workflows is becoming inadequate."
  },
  {
    title: "2026 in politics",
    url: "https://en.wikipedia.org/wiki/2026_in_politics",
    summary:
      "This Wikipedia article provides a dynamic list of political events and scheduled occurrences expected in 2026. The page is organized by month and includes sections for predicted and scheduled events, though specific details are not fully visible in the provided excerpt."
  },
  {
    title: "Turkish Readability and Content Quality of Strabismus-Related Websites",
    url: "https://pubmed.ncbi.nlm.nih.gov/38765432",
    summary:
      "A cross-sectional study assessed 41 websites about strabismus treatment using Turkish readability formulas and content quality indexes. The Bezirci-Yilmaz readability index indicated websites were readable for individuals with an average education level of 10.5 ± 2.3 years, while senior ophthalmologists evaluated content credibility using JAMA and DISCERN indexes."
  },
  {
    title: "AI Update, February 20, 2026: AI News and Views From the Past Week",
    url: "https://www.marketingprofs.com/opinions/2026/54328/ai-update-february-20-2026-ai-news-and-views-from-the-past-week",
    summary:
      "LinkedIn overhauled its SEO strategy after reporting a major B2B traffic decline, with non-brand, awareness-driven traffic dropping up to 60% as AI-powered search experiences reduced clickthrough behavior despite stable rankings."
  },
  {
    title: "Nullspace Steering Jailbreak: How Researchers Test AI Safety Through Adversarial Methods",
    url: "https://news.ufl.edu/2026/02/breaking-ai/",
    summary:
      "University of Florida researchers, led by Professor Sumit Kumar Jha, are conducting adversarial testing on large language models using techniques like nullspace steering and red teaming to identify failure modes and strengthen AI security. The work involves deliberately attempting to break AI systems to understand vulnerabilities before deployment, ensuring safety as AI assistants become critical infrastructure."
  },
  {
    title: "OpenClaw Multi-Agent Rollout: OpenAI vs Chinese Giants Recovery Lessons",
    url: "https://www.youtube.com/watch?v=BT02OEDY6H8",
    summary:
      "Unable to generate summary. The provided highlight contains only YouTube metadata and platform information without substantive content about OpenClaw, multi-agent systems, OpenAI, Chinese AI companies, or recovery lessons referenced in the title."
  },
  {
    title: "Modular Monolith Migration Pitfalls: Lessons from Service Weaver Rollouts",
    url: "https://conf.researchr.org/home/icse-2025/satrends-2025",
    summary:
      "Unable to generate summary. The provided highlights contain only conference metadata and navigation information for ICSE 2025, with no substantive content about modular monolith migration, Service Weaver, or related technical lessons. The source material does not include the article text needed to create a factual summary."
  }
];

function resolveSiteOrigin(): string {
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
    const callbackUrl = new URL("/auth/callback", resolveSiteOrigin());
    callbackUrl.searchParams.set("next", "/onboarding");
    callbackUrl.searchParams.set("callback_origin", window.location.origin);
    const redirectTo = callbackUrl.toString();
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
          <div className="mt-6 rounded-lg border border-[#EBA7A7] bg-[#FDE7E7] px-3 py-2">
            <p className="text-sm font-medium text-[#8F1D1D]">
              No-Circles is free through mid-March. After that, we plan to introduce a minimal at-cost subscription to
              cover infrastructure and API usage, with no profit margin.
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
