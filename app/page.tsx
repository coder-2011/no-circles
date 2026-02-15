"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";

type AuthState = "loading" | "signed_in" | "signed_out" | "error";

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const supabase = useMemo(() => {
    try {
      return getBrowserSupabaseClient();
    } catch {
      setAuthState("error");
      setAuthError("Auth client is not configured. Add Supabase env vars.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setAuthState("error");
        setAuthError(error.message);
        return;
      }

      if (data.user?.email) {
        setEmail(data.user.email);
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

  async function signInWithGoogle() {
    if (!supabase) return;

    setAuthError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
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
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-20 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(251,191,36,0.22),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(56,189,248,0.2),transparent_30%),radial-gradient(circle_at_70%_86%,rgba(251,146,60,0.22),transparent_36%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Serendipitous Encounters</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
            A daily brief for what your mind wants next.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-200/85">
            Sign in with Google, set your interests once, and get a personalized 10-link issue every morning.
            Reply to tune it over time.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1">Google OAuth</span>
            <span className="rounded-full border border-sky-300/40 bg-sky-300/10 px-3 py-1">Onboarding Memory</span>
            <span className="rounded-full border border-orange-300/40 bg-orange-300/10 px-3 py-1">Daily Delivery</span>
          </div>
        </section>

        <section className="rounded-3xl border border-white/20 bg-white p-7 text-slate-900 shadow-2xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Access</p>
          <h2 className="mt-3 text-2xl font-semibold">Get Started</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Frontend scope for this PR is auth entry + onboarding access control.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-800">Current state</p>
            <p className="mt-1 text-slate-600">
              {authState === "loading" && "Checking your session..."}
              {authState === "signed_in" && `Signed in as ${email}`}
              {authState === "signed_out" && "Signed out"}
              {authState === "error" && "Auth unavailable"}
            </p>
          </div>

          {authError ? (
            <p className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {authError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              disabled={authState === "loading"}
              onClick={signInWithGoogle}
              type="button"
            >
              Continue with Google
            </button>
            <Link
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              href="/onboarding"
            >
              Open onboarding
            </Link>
            {authState === "signed_in" ? (
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
