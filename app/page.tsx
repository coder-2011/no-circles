"use client";

import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Fraunces, Sora } from "next/font/google";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";
type AuthState = "loading" | "signed_in" | "signed_out" | "error";
type SampleBriefItem = {
  title: string;
  url: string;
  summary: string;
};
type SampleBriefResponse = { ok: true; items: SampleBriefItem[] } | { ok: false };
type MagneticOffset = { x: number; y: number };
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
  }
];
const displayFont = Fraunces({ subsets: ["latin"], weight: ["500", "600"] });
const interfaceFont = Sora({ subsets: ["latin"], weight: ["500", "600"] });
const MAGNETIC_ACTIVATION_RADIUS_PX = 96;
const MAGNETIC_MAX_SHIFT_PX = 12;
const MOUSE_TAIL_COUNT = 8;
function resolveSiteOrigin(): string {
  return window.location.origin;
}
function getAuthQueryErrorMessage(): string | null {
  const authCode = new URLSearchParams(window.location.search).get("auth");
  if (!authCode) return null;
  if (authCode === "required") return "Please sign in to continue.";
  if (authCode === "oauth_code_missing") return "Sign-in callback was incomplete. Please try again.";
  if (authCode === "oauth_error") return "Sign-in failed. Please try again.";
  return "Authentication failed. Please try again.";
}

function calculateMagneticOffset(clientX: number, clientY: number, rect: DOMRect): MagneticOffset {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const deltaX = clientX - centerX;
  const deltaY = clientY - centerY;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0 || distance >= MAGNETIC_ACTIVATION_RADIUS_PX) {
    return { x: 0, y: 0 };
  }

  const strength = (MAGNETIC_ACTIVATION_RADIUS_PX - distance) / MAGNETIC_ACTIVATION_RADIUS_PX;
  const shift = MAGNETIC_MAX_SHIFT_PX * strength;

  return {
    x: (deltaX / distance) * shift,
    y: (deltaY / distance) * shift
  };
}

function formatBriefIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}
export default function HomePage() {
  const router = useRouter();
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const tailDotRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const topButtonRef = useRef<HTMLButtonElement | null>(null);
  const heroButtonRef = useRef<HTMLButtonElement | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sampleBriefItems, setSampleBriefItems] = useState<SampleBriefItem[]>(SAMPLE_DAILY_BRIEF);
  const [topButtonOffset, setTopButtonOffset] = useState<MagneticOffset>({ x: 0, y: 0 });
  const [heroButtonOffset, setHeroButtonOffset] = useState<MagneticOffset>({ x: 0, y: 0 });
  const [pointerEffectsEnabled, setPointerEffectsEnabled] = useState(false);
  const [authClient] = useState<{ supabase: SupabaseClient | null; initError: string | null }>(() => {
    try {
      return { supabase: getBrowserSupabaseClient(), initError: null };
    } catch {
      return { supabase: null, initError: "Auth client is not configured. Add Supabase env vars." };
    }
  });
  const supabase = authClient.supabase;
  useEffect(() => {
    document.body.classList.add("home-page-body");
    return () => {
      document.body.classList.remove("home-page-body");
    };
  }, []);

  useEffect(() => {
    if (!authClient.initError) return;
    setAuthState("error");
    setAuthError(authClient.initError);
  }, [authClient.initError]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    if (!code) return;

    const nextParam = searchParams.get("next");
    const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : "/onboarding";
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("next", nextPath);
    router.replace(callbackUrl.pathname + callbackUrl.search);
  }, [router]);

  useEffect(() => {
    const queryError = getAuthQueryErrorMessage();
    if (queryError) {
      setAuthError(queryError);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

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
        return;
      }

      setAuthState("signed_out");
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
    if (authState === "signed_in" && window.location.search.includes("auth=")) {
      setAuthError(null);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [authState]);

  useEffect(() => {
    let active = true;

    void fetch("/api/sample-brief", { method: "GET" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as SampleBriefResponse | null;
        if (!active || !response.ok || !body || body.ok !== true || body.items.length === 0) {
          return;
        }

        setSampleBriefItems(body.items);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
    const update = () => {
      setPointerEffectsEnabled(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setTopButtonOffset({ x: 0, y: 0 });
        setHeroButtonOffset({ x: 0, y: 0 });
      }
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (!pointerEffectsEnabled) {
      return;
    }

    const updateOffsets = (event: MouseEvent) => {
      const topButton = topButtonRef.current;
      const heroButton = heroButtonRef.current;

      if (topButton) {
        setTopButtonOffset(calculateMagneticOffset(event.clientX, event.clientY, topButton.getBoundingClientRect()));
      }

      if (heroButton) {
        setHeroButtonOffset(calculateMagneticOffset(event.clientX, event.clientY, heroButton.getBoundingClientRect()));
      }
    };

    const resetOffsets = () => {
      setTopButtonOffset({ x: 0, y: 0 });
      setHeroButtonOffset({ x: 0, y: 0 });
    };

    window.addEventListener("mousemove", updateOffsets);
    window.addEventListener("mouseleave", resetOffsets);

    return () => {
      window.removeEventListener("mousemove", updateOffsets);
      window.removeEventListener("mouseleave", resetOffsets);
    };
  }, [pointerEffectsEnabled]);

  useEffect(() => {
    if (!pointerEffectsEnabled) {
      return;
    }

    const cursor = cursorRef.current;
    const tailDots = tailDotRefs.current.filter((dot): dot is HTMLSpanElement => dot !== null);
    if (!cursor || tailDots.length === 0) {
      return;
    }
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const trail = tailDots.map(() => ({ x: -999, y: -999 }));
    let visible = false;
    let cursorX = -999;
    let cursorY = -999;
    let targetX = -999;
    let targetY = -999;
    let frameId = 0;

    const updatePointerState = (target: EventTarget | null) => {
      const isPointer = target instanceof Element && target.closest("a,button");
      cursor.classList.toggle("home-page__cursor--pointer", Boolean(isPointer));
    };

    const handleMouseMove = (event: MouseEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      visible = true;
      updatePointerState(event.target);
    };

    const handleMouseLeave = () => {
      visible = false;
      cursor.classList.remove("home-page__cursor--pointer");
    };

    const render = () => {
      cursorX += (targetX - cursorX) * 0.28;
      cursorY += (targetY - cursorY) * 0.28;
      cursor.style.opacity = visible ? "1" : "0";
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;

      if (!prefersReducedMotion) {
        for (let index = 0; index < trail.length; index += 1) {
          const point = trail[index];
          const leader = index === 0 ? { x: targetX, y: targetY } : trail[index - 1];
          const easing = index === 0 ? 0.3 : 0.23;

          point.x += (leader.x - point.x) * easing;
          point.y += (leader.y - point.y) * easing;

          const dot = tailDots[index];
          const opacity = visible ? Math.max(0, 0.52 - index * 0.06) : 0;
          const scale = 1 - index * 0.08;
          const rotation = 45 + index * 7;

          dot.style.opacity = String(opacity);
          dot.style.transform = `translate3d(${point.x - 7}px, ${point.y - 7}px, 0) rotate(${rotation}deg) scale(${scale})`;
        }
      }

      frameId = window.requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [pointerEffectsEnabled]);

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

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() }
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

  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
  const displayedSampleBriefItems = sampleBriefItems.slice(0, 4);
  const topButtonNear = topButtonOffset.x !== 0 || topButtonOffset.y !== 0;
  const heroButtonNear = heroButtonOffset.x !== 0 || heroButtonOffset.y !== 0;
  const shellStyle = {
    "--home-display-font": displayFont.style.fontFamily,
    "--home-ui-font": interfaceFont.style.fontFamily
  } as CSSProperties;

  return (
    <div className="home-page-shell" style={shellStyle}>
      {pointerEffectsEnabled ? (
        <div className="home-page__mouse-tail-layer" aria-hidden="true">
          {Array.from({ length: MOUSE_TAIL_COUNT }).map((_, index) => (
            <span
              className="home-page__mouse-tail-dot"
              key={index}
              ref={(element) => {
                tailDotRefs.current[index] = element;
              }}
            />
          ))}
        </div>
      ) : null}
      {pointerEffectsEnabled ? <div aria-hidden="true" className="home-page__cursor" ref={cursorRef} /> : null}
      <button
        className={[
          "home-page__button",
          "home-page__floating-cta",
          "home-page__cta-magnet",
          interfaceFont.className,
          pointerEffectsEnabled && topButtonNear ? "is-near" : ""
        ].join(" ")}
        disabled={authState === "loading"}
        onClick={signInWithGoogle}
        ref={topButtonRef}
        style={pointerEffectsEnabled ? { transform: `translate(${topButtonOffset.x}px, ${topButtonOffset.y}px)` } : undefined}
        type="button"
      >
        Get Started
      </button>
      <main className="home-page" id="top">
        <div className="home-page__bg-glow" />
        <div className="home-page__container">
          <section className="home-page__panel home-page__hero">
            <p className="home-page__brand">The No-Circles Project</p>
            <h1 className="home-page__headline">Find what search would never show you.</h1>
            <div className="home-page__hero-actions">
              <button
                className={[
                  "home-page__button",
                  "home-page__cta-magnet",
                  interfaceFont.className,
                  pointerEffectsEnabled && heroButtonNear ? "is-near" : ""
                ].join(" ")}
                disabled={authState === "loading"}
                onClick={signInWithGoogle}
                ref={heroButtonRef}
                style={pointerEffectsEnabled ? { transform: `translate(${heroButtonOffset.x}px, ${heroButtonOffset.y}px)` } : undefined}
                type="button"
              >
                Distract Me Intelligently
              </button>
              <button
                className={["home-page__button", "home-page__button--muted", interfaceFont.className].join(" ")}
                onClick={authState === "signed_in" ? signOut : undefined}
                type="button"
              >
                Sign out
              </button>
            </div>
            {authState === "signed_in" && email ? <p className="home-page__status">Signed in as {email}</p> : null}
            {authError ? <p className="home-page__error">{authError}</p> : null}
          </section>

          <section className="home-page__panel home-page__overview" id="what">
            <p className="home-page__kicker">Overview</p>
            <h2 className="home-page__section-title">A cleaner way to follow your real interests.</h2>
            <p className="home-page__section-copy">
              No-Circles delivers 10 personalized long-form reads based on your current interests. Reply to the
              email, and tommorow&apos;s issue adjusts
            </p>
          </section>

          <section className="home-page__panel home-page__flow" id="flow">
            <p className="home-page__kicker home-page__kicker--flow">Flow</p>
            <div className="home-page__steps">
              <article className="home-page__step">
                <span className="home-page__step-num">01</span>
                <div className="home-page__step-copy">
                  <strong>Tell us what you are into.</strong>
                  <p>Write one short brain dump during onboarding.</p>
                </div>
              </article>
              <article className="home-page__step">
                <span className="home-page__step-num">02</span>
                <div className="home-page__step-copy">
                  <strong>Get one daily issue.</strong>
                  <p>Every issue contains 10 concise, source-linked reads.</p>
                </div>
              </article>
              <article className="home-page__step">
                <span className="home-page__step-num">03</span>
                <div className="home-page__step-copy">
                  <strong>Reply to shape the next issue.</strong>
                  <p>Your response guides the next picks.</p>
                </div>
              </article>
            </div>
          </section>

          <section className="home-page__panel home-page__sample" id="sample">
            <div className="home-page__brief-head">
              <div>
                <h2 className="home-page__section-title">A Recent Daily Issue</h2>
                <p className="home-page__brief-note">This preview is pulled from a recent real No-Circles daily brief.</p>
              </div>
              <p className="home-page__date-chip">{currentDateLabel}</p>
            </div>
            <ul className="home-page__brief-list">
              {displayedSampleBriefItems.map((item, index) => (
                <li className="home-page__brief-item" key={item.url}>
                  <span className="home-page__brief-index">{formatBriefIndex(index)}</span>
                  <a href={item.url} rel="noreferrer" target="_blank">
                    {item.title}
                  </a>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ul>
          </section>

          <p className="home-page__warning">
            No-Circles is free through mid-March. Then we plan a minimal at-cost subscription for infrastructure and
            API spend.
          </p>
        </div>
      </main>
    </div>
  );
}
