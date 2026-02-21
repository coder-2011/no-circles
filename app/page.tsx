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
    title: "Why Retrieval Pipelines Fail in Production Before They Fail in Benchmarks",
    url: "https://www.pinecone.io/learn/retrieval-augmented-generation/",
    summary:
      "Offline accuracy can look great while production answers degrade because retrieval quality drifts first. The key idea is to monitor retrieval as its own system, not just final outputs, so teams can catch quality drops early and fix recall, context quality, or ranking before trust breaks."
  },
  {
    title: "How Industrial Policy Works When Execution Capacity Is Real",
    url: "https://www.oecd.org/industry/industrial-policy.htm",
    summary:
      "Industrial policy succeeds when institutions can execute consistently, not just announce priorities. Programs work better when goals are narrow, milestones are measurable, and agencies can deliver on schedule; otherwise money and policy intent drift apart."
  },
  {
    title: "Supply-Chain Resilience Is a Portfolio Problem, Not a Single Fix",
    url: "https://www.weforum.org/agenda/2023/01/what-is-supply-chain-resilience/",
    summary:
      "Resilience is built from multiple safeguards working together, not one silver bullet. The article’s core point is that cost efficiency alone makes systems fragile, while visibility, alternatives, and fast decision protocols help operations recover when shocks hit."
  },
  {
    title: "Grid Congestion Is Becoming the Hidden Bottleneck for Clean-Energy Buildout",
    url: "https://www.iea.org/reports/electricity-grids-and-secure-energy-transitions",
    summary:
      "Clean-energy rollout is increasingly limited by grid delivery capacity, not generation ambition. The main takeaway is coordination: permitting, transmission planning, and long-lead equipment timelines have to move in sync or projects stall in queues."
  },
  {
    title: "Housing Production Depends on Permit Throughput More Than Policy Headlines",
    url: "https://www.brookings.edu/articles/how-local-governments-can-boost-housing-supply/",
    summary:
      "Housing outcomes often diverge because city permitting systems run at different speeds. The article’s central claim is that supply is an execution problem: predictable review timelines and simpler processes can matter as much as headline policy targets."
  },
  {
    title: "Protein Folding Progress Still Leaves the Hard Biology in Dynamics and Context",
    url: "https://www.nature.com/articles/d41586-024-00380-7",
    summary:
      "Protein-structure prediction solved a major puzzle, but biology still depends on motion and context inside real cells. The useful point is where models stop being enough and experiments still carry the decisive evidence."
  },
  {
    title: "Machiavelli’s Core Insight: Durable Orders Need Both Consent and Coercive Capacity",
    url: "https://plato.stanford.edu/entries/machiavelli/",
    summary:
      "Machiavelli’s core lesson is about political durability under stress, not just manipulation. Institutions tend to hold when legitimacy and enforcement capacity stay aligned, and weaken when either side breaks."
  },
  {
    title: "Cognitive Bias Debiasing Works Better as Process Design Than Willpower",
    url: "https://thedecisionlab.com/biases",
    summary:
      "Bias mitigation works best when it is built into process, not left to personal discipline in high-pressure moments. The article argues for structural guardrails that catch predictable reasoning errors before they shape decisions."
  },
  {
    title: "How Musical Expectation Shapes Attention and Memory Encoding",
    url: "https://www.frontiersin.org/articles/10.3389/fpsyg.2013.00511/full",
    summary:
      "Music guides attention by balancing predictability and surprise. The transferable insight is that people remember information better when structure is clear but still varied enough to keep attention active."
  },
  {
    title: "Experimentation Programs Fail When Metrics Are Detached from Decisions",
    url: "https://www.gov.uk/service-manual/measuring-success/ab-testing",
    summary:
      "A/B testing becomes misleading when metrics are easy to move but disconnected from real product choices. The main idea is to tie experiments to decision-quality and guardrails, so local wins do not degrade long-term outcomes."
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
