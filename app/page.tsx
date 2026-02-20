"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthState = "loading" | "signed_in" | "signed_out" | "error";

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

function hasOAuthCodeParam(): boolean {
  return new URLSearchParams(window.location.search).has("code");
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

    if (!hasOAuthCodeParam()) {
      return;
    }

    router.replace("/onboarding");
  }, [authState, router]);

  async function signInWithGoogle() {
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
          <div className="mt-5 space-y-5 text-lg leading-8 text-[#4A5641]">
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
