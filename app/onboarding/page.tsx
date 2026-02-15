"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthState = "loading" | "signed_in" | "signed_out" | "error";
type SubmitState = "idle" | "saving" | "saved" | "error";

export default function OnboardingPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [preferredName, setPreferredName] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [sendTime, setSendTime] = useState("08:00");
  const [brainDumpText, setBrainDumpText] = useState("");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    try {
      setSupabase(getBrowserSupabaseClient());
    } catch {
      setAuthState("error");
      setMessage("Auth client is not configured. Add Supabase env vars.");
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
        setMessage(error.message);
        return;
      }

      if (data.user?.email) {
        setEmail(data.user.email);
        setAuthState("signed_in");
      } else {
        setAuthState("signed_out");
      }
    });

    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (authState !== "signed_out") {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.replace("/?auth=required");
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [authState, router]);

  async function signInWithGoogle() {
    if (!supabase) return;

    setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.assign("/");
  }

  async function submitOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("saving");
    setMessage(null);

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        preferred_name: preferredName,
        timezone,
        send_time_local: sendTime,
        brain_dump_text: brainDumpText
      })
    });

    const body = (await response.json().catch(() => null)) as
      | { ok: true; user_id: string }
      | { ok: false; message?: string; error_code?: string }
      | null;

    if (response.ok) {
      setSubmitState("saved");
      setMessage("Onboarding saved. You are configured for daily delivery.");
      return;
    }

    setSubmitState("error");

    if (response.status === 401) {
      setMessage("Your session expired. Sign in again.");
      setAuthState("signed_out");
      return;
    }

    const errorMessage = body && "ok" in body && body.ok === false ? body.message : undefined;
    setMessage(errorMessage ?? "Could not save onboarding preferences.");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Set your daily brief</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Auth state is required for this page. Signed-out users are redirected to home.
        </p>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="font-medium text-slate-700">Session:</span>{" "}
          <span className="text-slate-600">
            {authState === "loading" && "Checking..."}
            {authState === "signed_in" && `Signed in as ${email}`}
            {authState === "signed_out" && "Signed out. Redirecting..."}
            {authState === "error" && "Unavailable"}
          </span>
        </div>

        {authState === "signed_out" ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              onClick={signInWithGoogle}
              type="button"
            >
              Sign in again
            </button>
            <Link
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              href="/"
            >
              Back to home
            </Link>
          </div>
        ) : null}

        {authState === "signed_in" ? (
          <form className="mt-7 space-y-5" onSubmit={submitOnboarding}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Preferred name</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                onChange={(event) => setPreferredName(event.target.value)}
                placeholder="Naman"
                required
                value={preferredName}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Timezone</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  onChange={(event) => setTimezone(event.target.value)}
                  required
                  value={timezone}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Send time (local)</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  onChange={(event) => setSendTime(event.target.value)}
                  required
                  type="time"
                  value={sendTime}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Interest brain dump</span>
              <textarea
                className="h-48 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-slate-500 focus:outline-none"
                onChange={(event) => setBrainDumpText(event.target.value)}
                placeholder="What are you curious about lately? What do you want to avoid?"
                required
                value={brainDumpText}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                disabled={submitState === "saving"}
                type="submit"
              >
                {submitState === "saving" ? "Saving..." : "Save preferences"}
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            </div>
          </form>
        ) : null}

        {message ? (
          <p
            className={`mt-5 rounded-lg px-3 py-2 text-sm ${
              submitState === "saved"
                ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
