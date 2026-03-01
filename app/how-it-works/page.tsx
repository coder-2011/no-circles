"use client";

import { HOME_PAGE_SUBSYSTEMS, HOW_IT_WORKS_INTRO } from "@/app/home-page-content";
import { HomePageNav } from "@/app/home-page-nav";
import { SiteCursor } from "@/components/site-cursor";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Fraunces, Sora } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";

const displayFont = Fraunces({ subsets: ["latin"], weight: ["500", "600"] });
const interfaceFont = Sora({ subsets: ["latin"], weight: ["500", "600"] });
const MAGNETIC_ACTIVATION_RADIUS_PX = 96;
const MAGNETIC_MAX_SHIFT_PX = 12;

type AuthState = "loading" | "signed_in" | "signed_out" | "error";
type MagneticOffset = { x: number; y: number };

function resolveSiteOrigin(): string {
  return window.location.origin;
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

export default function HowItWorksPage() {
  const router = useRouter();
  const topButtonRef = useRef<HTMLButtonElement | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [topButtonOffset, setTopButtonOffset] = useState<MagneticOffset>({ x: 0, y: 0 });
  const [pointerEffectsEnabled, setPointerEffectsEnabled] = useState(false);
  const [authClient] = useState<{ supabase: SupabaseClient | null; initError: string | null }>(() => {
    try {
      return { supabase: getBrowserSupabaseClient(), initError: null };
    } catch {
      return { supabase: null, initError: "Auth client is not configured. Add Supabase env vars." };
    }
  });
  const supabase = authClient.supabase;
  const shellStyle = {
    "--home-display-font": displayFont.style.fontFamily,
    "--home-ui-font": interfaceFont.style.fontFamily
  } as CSSProperties;

  useEffect(() => {
    document.body.classList.add("home-page-body");
    return () => {
      document.body.classList.remove("home-page-body");
    };
  }, []);

  useEffect(() => {
    if (authClient.initError) {
      setAuthState("error");
    }
  }, [authClient.initError]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        setAuthState("error");
        return;
      }

      setAuthState(data.session?.user?.email ? "signed_in" : "signed_out");
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session?.user?.email ? "signed_in" : "signed_out");
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
    const update = () => {
      setPointerEffectsEnabled(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setTopButtonOffset({ x: 0, y: 0 });
      }
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !pointerEffectsEnabled) {
      return;
    }

    const updateOffsets = (event: MouseEvent) => {
      const topButton = topButtonRef.current;
      if (topButton) {
        setTopButtonOffset(calculateMagneticOffset(event.clientX, event.clientY, topButton.getBoundingClientRect()));
      }
    };

    const resetOffsets = () => {
      setTopButtonOffset({ x: 0, y: 0 });
    };

    window.addEventListener("mousemove", updateOffsets);
    window.addEventListener("mouseleave", resetOffsets);

    return () => {
      window.removeEventListener("mousemove", updateOffsets);
      window.removeEventListener("mouseleave", resetOffsets);
    };
  }, [pointerEffectsEnabled]);

  async function signInWithGoogle() {
    if (authState === "signed_in") {
      router.replace("/onboarding");
      return;
    }

    if (!supabase) {
      return;
    }

    const callbackUrl = new URL("/auth/callback", resolveSiteOrigin());
    callbackUrl.searchParams.set("next", "/onboarding");
    callbackUrl.searchParams.set("callback_origin", window.location.origin);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() }
    });
  }

  return (
    <div className="home-page-shell" style={shellStyle}>
      <SiteCursor />
      <button
        className={[
          "home-page__button",
          "home-page__floating-cta",
          "home-page__cta-magnet",
          interfaceFont.className,
          pointerEffectsEnabled && (topButtonOffset.x !== 0 || topButtonOffset.y !== 0) ? "is-near" : ""
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
        <div className="home-page__container home-page__container--wide">
          <section className="home-page__panel home-page__topbar">
            <HomePageNav activeTab="how-it-works" />
          </section>
          <section className="home-page__panel home-page__how-page">
            <p className="home-page__kicker">How It Works</p>
            <h1 className="home-page__section-title home-page__how-page-title">
              Finding ungoogleable inspiration.
            </h1>
            {HOW_IT_WORKS_INTRO.map((paragraph) => (
              <p className="home-page__section-copy home-page__how-page-copy" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </section>
          <section className="home-page__panel home-page__how-grid">
            {HOME_PAGE_SUBSYSTEMS.map((subsystem) => (
              <article className="home-page__how-card" key={subsystem.number}>
                <p className="home-page__how-card-number">{subsystem.number}</p>
                <h2 className="home-page__how-card-title">{subsystem.title}</h2>
                <p className="home-page__how-card-copy">{subsystem.description}</p>
              </article>
            ))}
          </section>
          <section className="home-page__panel home-page__how-closing">
            <p className="home-page__section-copy home-page__how-page-copy">A daily reading habit that gets better over time.</p>
            <Link className={["home-page__button", interfaceFont.className].join(" ")} href="/">
              Back to Home
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
