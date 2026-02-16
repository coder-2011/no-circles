 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthState = "loading" | "signed_in" | "signed_out" | "error";

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    try {
      setSupabase(getBrowserSupabaseClient());
    } catch {
      setAuthState("error");
      setAuthError("Auth client is not configured. Add Supabase env vars.");
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
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setAuthError(error.message);
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-20 text-slate-100" id="top">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(251,191,36,0.22),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(56,189,248,0.2),transparent_30%),radial-gradient(circle_at_70%_86%,rgba(251,146,60,0.22),transparent_36%)]" />
      <div className="relative mx-auto w-full max-w-5xl space-y-8">
        <section className="rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur">
          <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">Serendipitous Encounters</h1>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="inline-flex rounded-lg border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20"
              href="/onboarding"
            >
              Get started
            </Link>
            <button
              className="rounded-lg border border-sky-300/60 bg-sky-300/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/20 disabled:opacity-60"
              disabled={authState === "loading"}
              onClick={signInWithGoogle}
              type="button"
            >
              Continue with Google
            </button>
            {authState === "signed_in" ? (
              <button
                className="rounded-lg border border-slate-300/60 bg-slate-300/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-300/20"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-300">
            {authState === "signed_in" && email ? `Signed in as ${email}` : "Sign in to save onboarding securely."}
          </p>
          {authError ? <p className="mt-2 text-sm text-rose-300">{authError}</p> : null}
        </section>

        <section className="rounded-3xl border border-white/20 bg-white p-7 text-slate-900 shadow-2xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Annotated Example Newsletter</p>
          <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
            <p>
              [Header annotation] Daily issue for <span className="font-medium">Sample Reader</span> • 10 curated items
              • neutral summaries
            </p>
            <p>
              [Item annotation] <span className="font-medium">Example Link Title</span> - Placeholder summary text for
              article context and key signal. (We will replace this with final copy later.)
            </p>
            <p>
              [Discovery annotation] One adjacent topic pick appears here with a short rationale for why it fits the
              reader profile.
            </p>
            <p>
              [Reply annotation] Footer reminds user to reply with preferences like &quot;more X, less Y&quot; to tune tomorrow&apos;s
              issue.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
