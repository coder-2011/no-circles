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
    title: "AI Update, February 20, 2026: AI News and Views From the Past Week",
    url: "https://www.marketingprofs.com/opinions/2026/54328/ai-update-february-20-2026-ai-news-and-views-from-the-past-week",
    summary:
      "LinkedIn overhauled its SEO strategy following a significant decline in B2B traffic. The platform reported that non-brand, awareness-driven B2B traffic dropped by up to 60% as AI-powered search experiences reduced clickthrough behavior, even though search rankings remained stable. This traffic decline prompted LinkedIn to reassess its approach to search engine optimization."
  },
  {
    title: "Global Summits to Watch in 2026: Bracing for a New Global (Dis)order",
    url: "https://www.cfr.org/articles/global-summits-watch-2026-bracing-new-global-disorder",
    summary:
      "Major global forums are scheduled in 2026 covering climate change, trade, and security. The Donald Trump administration's ongoing overhaul of U.S. foreign policy could disrupt how these gatherings are conducted. The World Economic Forum in Davos, Switzerland represents one such venue where these dynamics may unfold."
  },
  {
    title: "26 Trends Affecting Capital Markets in 2026",
    url: "https://corpgov.law.harvard.edu/2026/01/25/26-trends-affecting-capital-markets-in-2026/",
    summary:
      "Capital markets have experienced significant structural shifts, particularly the rise of private markets relative to public markets. Private assets grew from $9.7 trillion in 2012 to $22 trillion in 2024, more than doubling over 12 years. Companies are staying private longer, with an average wait of 16 years before going public, representing a 33 percent increase compared to a decade earlier. These trends have become more pronounced since the Sarbanes-Oxley Act adoption. Enhanced retail access to private markets has emerged as a focus of policymaker attention following recent administrative changes."
  },
  {
    title: "Economic Trends for 2026 and Beyond | Vistage",
    url: "https://www.vistage.com/research-center/business-financials/economic-trends/20251027-economic-trends-for-2026-and-beyond/",
    summary:
      "Small and midsize businesses face sustained stagflationary conditions in 2026 and beyond, with inflation remaining above the Federal Reserve's target despite cooling from 40-year highs. Tariffs and rising input costs are compressing margins, while labor scarcity drives wage and benefit increases. The cost of capital remains elevated, constraining growth plans. The analysis recommends that SMBs prioritize margin protection over revenue growth. Opportunities exist in productivity gains through AI and expansion in tech, healthcare, and clean energy sectors. Through Q3 2025, the S&P 500 gained 9.8% and the Nasdaq showed resilience despite these economic headwinds."
  },
  {
    title: "WMO Global Annual to Decadal Climate Update (2025-2029)",
    url: "https://wmo.int/publication-series/wmo-global-annual-decadal-climate-update-2025-2029",
    summary:
      "The WMO Global Annual to Decadal Climate Update projects global temperatures will remain at or near record levels from 2025-2029, with annually averaged near-surface temperatures predicted between 1.2°C and 1.9°C above 1850-1900 baseline. An 80% probability exists that at least one year will exceed 2024 as the warmest on record, while an 86% probability indicates at least one year will surpass 1.5°C above pre-industrial levels. The five-year average warming probability for 2025-2029 exceeding 1.5°C stands at 70%, up from 47% previously. Arctic warming is predicted to continue outpacing global average warming, with precipitation patterns showing significant regional variations."
  },
  {
    title: "Ten Cancer-Related Breakthroughs Giving Us Hope in 2026",
    url: "https://blog.dana-farber.org/insight/2026/01/ten-cancer-related-breakthroughs-giving-us-hope-in-2026/",
    summary:
      "Cancer treatment research at Dana-Farber has produced breakthroughs including targeted therapies and cancer vaccines. Menin inhibitors, two targeted therapies recently approved for approximately 40% of acute myeloid leukemia (AML) cases, represent a significant advancement for this previously difficult-to-treat disease. Researchers are now testing menin inhibitors in combination with other therapies to achieve substantial survival benefits for patients with AML and pancreatic cancer."
  },
  {
    title: "University of Cincinnati study sheds light on survival of new neurons in adult brain",
    url: "https://www.eurekalert.org/news-releases/1115910",
    summary:
      "Research from the University of Cincinnati College of Medicine, published in Nature Communications, reveals how immune cells in the adult brain regulate neurogenesis—the generation of new neurons. Immune cells conduct surveillance and send messages to developing neurons. Adult neurogenesis supports learning, memory, and mood regulation. Exercise, sleep, and learning stimulate the process, while stress and aging decrease it, potentially explaining cognitive decline in older adults."
  },
  {
    title: "Scientists Capture a Glimpse into the Quantum Vacuum",
    url: "https://www.bnl.gov/newsroom/news.php?a=122738",
    summary:
      "Scientists have made new findings on particle spin correlations that provide insight into how visible matter emerges from the quantum vacuum. The research examines dynamic fluctuations of energy fields in the quantum vacuum. These findings were announced by Brookhaven National Laboratory on February 4, 2026, and represent observations of previously difficult-to-access quantum phenomena related to the fundamental nature of matter."
  },
  {
    title: "Future Issues in Global Health: Challenges and Conundrums - PMC",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11942303/",
    summary:
      "Int J Environ Res Public Health . 2025 Feb 21;22(3):325. doi: 10.3390/ijerph22030325 Search in PMC Search in PubMed View in NLM Catalog Add to search Future Issues in Global Health: Challenges and Conundrums Manoj Sharma Manoj Sharma 1 Department of Social and Behavioral Health, School of Public Health, University of Nevada, Las Vegas, NV 89119, USA 2 Department of Internal Medicine, Kirk Kerkorian School of Medicine at UNLV, University of Nevada, Las Vegas, NV 89102, USA Find articles by Manoj Sharma 1, 2 , Md Sohail Akhter Md Sohail Akhter 1 Department of Social and Behavioral Health, School of Public Health, University of Nevada, Las Vegas, NV 89119, USA Find articles by Md Sohail Akhter 1, * , Sharmistha Roy"
  },
  {
    title: "4 Health Issues We're Watching in 2025 | Project HOPE",
    url: "https://www.projecthope.org/news-stories/story/4-health-issues-were-watching-in-2025/",
    summary:
      "Project HOPE identified four urgent global health priorities for 2025: maternal health emergencies, infectious disease threats, mental health and psychosocial support, and primary health care strengthening. In the prior year, the organization reached 4.4 million people, provided direct medical services to 2.8 million patients, screened 655,000 people for disease, and donated $79 million in equipment and supplies. The organization addresses interconnected crises driven by conflict, displacement, poverty, and disease pressuring health systems worldwide."
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
          <h1 className="text-5xl font-semibold leading-tight text-[#2B3125] md:text-6xl">Find what search would never show you.</h1>
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
          <div className="mt-6 grid max-w-6xl gap-4 md:grid-cols-[1.45fr_1fr]">
            <div className="relative overflow-hidden rounded-[1.9rem] border border-[#C9BD9A] bg-[#FBF7EB] px-6 py-6 shadow-sm md:px-8 md:py-7">
              <span className="pointer-events-none absolute right-5 top-4 rounded-full border border-[#CDBF98] bg-[#EFE5CD] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5A6650]">
                Daily: 10 reads
              </span>
              <p className="max-w-3xl pt-8 text-[1.45rem] font-semibold leading-[1.35] text-[#374230] md:pt-6 md:text-[1.95rem]">
                No-Circles curates 10 high-signal, niche long-form pieces every morning, optimized for unexpected but
                meaningful discovery.
              </p>
              <p className="mt-4 max-w-3xl text-lg leading-[1.55] text-[#4A5641] md:text-xl">
                And When your interests change or you choose a new side quest, you reply to the email and your daily
                newletter updates
              </p>
            </div>
            <div className="relative rounded-[1.3rem] border border-[#CDBF98] bg-[#F6EFD9] px-5 py-5 shadow-sm md:-ml-4 md:mt-6 md:rotate-[-1deg]">
              <div className="pointer-events-none absolute -right-2 -top-2 h-6 w-6 rounded-md border border-[#CDBF98] bg-[#EFE5CD] rotate-12" />
              <p className="text-[1.02rem] leading-[1.55] text-[#4C5A45] md:text-[1.22rem]">
                The principle is that great ideas come from unexpected places, so we should encourage people toward
                more unexpected endeavors.
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-[#EBA7A7] bg-[#FDE7E7] px-3 py-2">
            <p className="text-sm font-medium text-[#8F1D1D]">
              No-Circles is free through mid-March. After that, we plan to introduce a minimal at-cost subscription to
              cover infrastructure and API usage, with no profit margin.
            </p>
          </div>
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
