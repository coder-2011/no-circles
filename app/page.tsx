"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthState = "loading" | "signed_in" | "signed_out" | "error";

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

    router.replace("/");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F3ECD8] px-6 py-20 text-[#2D3426]" id="top">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(61,111,73,0.14),transparent_40%),radial-gradient(circle_at_82%_8%,rgba(198,182,137,0.24),transparent_36%),radial-gradient(circle_at_70%_86%,rgba(93,131,89,0.12),transparent_40%)]" />
      <div className="relative mx-auto w-full max-w-5xl space-y-8">
        <section className="rounded-3xl border border-[#C9BD9A] bg-[#F8F3E4] p-8 shadow-sm">
          <h1 className="text-4xl font-semibold leading-tight text-[#2B3125] md:text-5xl">Serendipitous Encounters</h1>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-lg border border-[#3D6F49] bg-[#3D6F49] px-4 py-2 text-sm font-medium text-[#F3ECD8] transition hover:bg-[#315E3E] disabled:opacity-60"
              disabled={authState === "loading"}
              onClick={signInWithGoogle}
              type="button"
            >
              Get started
            </button>
            {authState === "signed_in" ? (
              <button
                className="rounded-lg border border-[#A49671] bg-[#EFE7D0] px-4 py-2 text-sm font-medium text-[#374230] transition hover:bg-[#E5DCC3]"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-base font-medium text-[#526149]">
            {authState === "signed_in" && email ? `Signed in as ${email}` : "Sign in to save onboarding securely."}
          </p>
          {authError ? <p className="mt-2 text-sm text-rose-700">{authError}</p> : null}
        </section>

        <section className="rounded-3xl border border-[#C9BD9A] bg-[#FBF7EB] p-7 text-[#2D3426] shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B775D]">Sample Daily Brief</p>
          <div className="mt-4 space-y-4 text-base leading-7 text-[#4A5641]">
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
      <p className="pointer-events-none fixed bottom-4 right-4 text-xs font-medium text-[#6B775D]/90">
        built by Naman Chetwani
      </p>
    </main>
  );
}
