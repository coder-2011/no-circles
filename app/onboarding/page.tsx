"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthState = "loading" | "signed_in" | "signed_out" | "error";
type SubmitState = "idle" | "saving" | "saved" | "error";
const BRAIN_DUMP_WORD_LIMIT = 500;
const BRAIN_DUMP_DRAFT_KEY = "onboarding_brain_dump_draft_v1";
const CURATED_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata"
] as const;
const INTEREST_QUICK_SPARKS = [
  "AI research breakthroughs",
  "Systems design and engineering strategy",
  "Philosophy that changes decisions",
  "History with modern parallels",
  "Deep dives on scientific discoveries",
  "Great books and long-form writing",
  "Economics through first principles"
] as const;
const PREFERRED_NAME_SUGGESTIONS = [
  "Alan Turing",
  "Fyodor Dostoevsky",
  "Nikola Tesla",
  "Ada Lovelace",
  "Marie Curie",
  "Srinivasa Ramanujan",
  "Hannah Arendt",
  "Carl Sagan"
] as const;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function truncateToWordLimit(text: string, wordLimit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordLimit) {
    return text;
  }

  return words.slice(0, wordLimit).join(" ");
}

function parseSendTime(sendTime: string): { hour12: string; minute: string; meridiem: "AM" | "PM" } {
  const [hourToken, minuteToken] = sendTime.split(":");
  const hour = Number.parseInt(hourToken ?? "8", 10);
  const minute = Number.parseInt(minuteToken ?? "0", 10);

  const safeHour24 = Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 8;
  const safeMinute = Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0;
  const meridiem: "AM" | "PM" = safeHour24 >= 12 ? "PM" : "AM";
  const hour12Raw = safeHour24 % 12;
  const hour12 = hour12Raw === 0 ? 12 : hour12Raw;

  return { hour12: String(hour12), minute: String(safeMinute).padStart(2, "0"), meridiem };
}

function buildSendTime(hour12: string, minute: string, meridiem: "AM" | "PM"): string {
  const parsedHour12 = Number.parseInt(hour12, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  const normalizedHour12 = Number.isFinite(parsedHour12) ? Math.max(1, Math.min(12, parsedHour12)) : 8;
  const normalizedMinute = Number.isFinite(parsedMinute) ? Math.max(0, Math.min(59, parsedMinute)) : 0;

  let hour24 = normalizedHour12 % 12;
  if (meridiem === "PM") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [preferredName, setPreferredName] = useState("");
  const [preferredNameSuggestion, setPreferredNameSuggestion] = useState(
    PREFERRED_NAME_SUGGESTIONS[0]
  );
  const [timezone, setTimezone] = useState(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return CURATED_TIMEZONES.includes(detected as (typeof CURATED_TIMEZONES)[number])
      ? detected
      : "America/New_York";
  });
  const defaultSendParts = parseSendTime("08:00");
  const [sendHour12, setSendHour12] = useState(defaultSendParts.hour12);
  const [sendMinute, setSendMinute] = useState(defaultSendParts.minute);
  const [sendMeridiem, setSendMeridiem] = useState<"AM" | "PM">(defaultSendParts.meridiem);
  const [sendTime, setSendTime] = useState(buildSendTime(defaultSendParts.hour12, defaultSendParts.minute, defaultSendParts.meridiem));
  const [brainDumpText, setBrainDumpText] = useState("");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const brainDumpWordCount = countWords(brainDumpText);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * PREFERRED_NAME_SUGGESTIONS.length);
    setPreferredNameSuggestion(PREFERRED_NAME_SUGGESTIONS[randomIndex]);
  }, []);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(BRAIN_DUMP_DRAFT_KEY);
    if (savedDraft) {
      setBrainDumpText(truncateToWordLimit(savedDraft, BRAIN_DUMP_WORD_LIMIT));
    }
  }, []);

  useEffect(() => {
    if (!brainDumpText.trim()) {
      window.localStorage.removeItem(BRAIN_DUMP_DRAFT_KEY);
      return;
    }

    window.localStorage.setItem(BRAIN_DUMP_DRAFT_KEY, brainDumpText);
  }, [brainDumpText]);

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
    setShowCelebration(false);

    if (brainDumpWordCount > BRAIN_DUMP_WORD_LIMIT) {
      setSubmitState("error");
      setMessage(`Interest brain dump must be ${BRAIN_DUMP_WORD_LIMIT} words or fewer.`);
      return;
    }

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
      setShowCelebration(true);
      window.localStorage.removeItem(BRAIN_DUMP_DRAFT_KEY);
      window.setTimeout(() => {
        setShowCelebration(false);
      }, 1400);
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

  function appendQuickSpark(spark: string) {
    setBrainDumpText((current) => {
      const normalizedCurrent = current.trimEnd();
      const bullet = `- ${spark}`;
      const hasLineAlready = normalizedCurrent
        .split("\n")
        .some((line) => line.trim().toLowerCase() === bullet.toLowerCase());

      if (hasLineAlready) {
        return current;
      }

      const nextText = normalizedCurrent ? `${normalizedCurrent}\n${bullet}` : bullet;
      return truncateToWordLimit(nextText, BRAIN_DUMP_WORD_LIMIT);
    });
  }

  return (
    <main className="min-h-screen bg-[#F3ECD8] px-6 py-12 text-[#2D3426]">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-[#C9BD9A] bg-[#FAF5E8] p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6B775D]">Onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#2B3125]">What are you curious about?</h1>
        <p className="mt-3 text-sm leading-6 text-[#4B5943]">
          Leave breadcrumbs for tomorrow-you: obsessions, rabbit holes, and what to skip.
        </p>

        <div className="mt-5 rounded-lg border border-[#D8CCAA] bg-[#F4EEDC] px-4 py-3 text-sm">
          <span className="font-medium text-[#3E4A36]">Session:</span>{" "}
          <span className="text-[#5A6650]">
            {authState === "loading" && "Checking..."}
            {authState === "signed_in" && `Signed in as ${email}`}
            {authState === "signed_out" && "Signed out. Redirecting..."}
            {authState === "error" && "Unavailable"}
          </span>
        </div>

        {authState === "signed_out" ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-[#3D6F49] px-4 py-2 text-sm font-medium text-[#F3ECD8] transition hover:bg-[#315E3E]"
              onClick={signInWithGoogle}
              type="button"
            >
              Sign in again
            </button>
            <Link
              className="rounded-lg border border-[#B8AA84] px-4 py-2 text-sm font-medium text-[#40503A] transition hover:bg-[#EFE5CD]"
              href="/"
            >
              Back to home
            </Link>
          </div>
        ) : null}

        {authState === "signed_in" ? (
          <form className="mt-7 space-y-5" onSubmit={submitOnboarding}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Preferred name</span>
              <input
                className="w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-3 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
                onChange={(event) => setPreferredName(event.target.value)}
                placeholder={preferredNameSuggestion}
                required
                value={preferredName}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Timezone</span>
                <select
                  className="w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-3 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
                  onChange={(event) => setTimezone(event.target.value)}
                  required
                  value={timezone}
                >
                  {CURATED_TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Send time (local)</span>
                <div className="rounded-lg border border-[#C7BA95] bg-[#FFFDF8] p-2">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
                      onChange={(event) => {
                        const nextHour = event.target.value;
                        setSendHour12(nextHour);
                        setSendTime(buildSendTime(nextHour, sendMinute, sendMeridiem));
                      }}
                      value={sendHour12}
                    >
                      {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
                      onChange={(event) => {
                        const nextMinute = event.target.value;
                        setSendMinute(nextMinute);
                        setSendTime(buildSendTime(sendHour12, nextMinute, sendMeridiem));
                      }}
                      value={sendMinute}
                    >
                      {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0")).map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
                      onChange={(event) => {
                        const nextMeridiem = event.target.value as "AM" | "PM";
                        setSendMeridiem(nextMeridiem);
                        setSendTime(buildSendTime(sendHour12, sendMinute, nextMeridiem));
                      }}
                      value={sendMeridiem}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                  <span className="mt-1 block text-xs text-[#6B775D]">Your local delivery time.</span>
                </div>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Interest brain dump</span>
              <textarea
                className="h-48 w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-3 py-2 text-sm leading-6 focus:border-[#3D6F49] focus:outline-none"
                onChange={(event) =>
                  setBrainDumpText(truncateToWordLimit(event.target.value, BRAIN_DUMP_WORD_LIMIT))
                }
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Add what you want more of, less of, and what kind of ideas you want to stumble into."
                required
                value={brainDumpText}
              />
              <div className="mt-2 flex flex-wrap gap-2.5">
                {INTEREST_QUICK_SPARKS.map((spark) => (
                  <button
                    className="rounded-full border border-[#CDBF98] bg-[#F6EFD9] px-3 py-1 text-xs font-medium text-[#4F5D45] transition hover:bg-[#ECE2C8]"
                    key={spark}
                    onClick={() => appendQuickSpark(spark)}
                    type="button"
                  >
                    {spark}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-xs text-[#6B775D]">
                {brainDumpWordCount}/{BRAIN_DUMP_WORD_LIMIT} words
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <div className="relative flex items-center gap-2">
                <button
                  className="rounded-lg bg-[#3D6F49] px-4 py-2 text-sm font-medium text-[#F3ECD8] transition hover:bg-[#315E3E] disabled:opacity-50"
                  disabled={submitState === "saving"}
                  type="submit"
                >
                  {submitState === "saving" ? (
                    "Saving..."
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span>Save preferences</span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#7FAF8A] bg-[#2F5C3A] px-1.5 py-0.5 text-[10px] font-semibold text-[#E7F2DF]">
                        <span>⌘</span>
                        <span>↵</span>
                      </span>
                    </span>
                  )}
                </button>
                <span
                  className={`pointer-events-none absolute -bottom-7 left-0 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition duration-300 ${
                    showCelebration ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0"
                  }`}
                >
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Saved
                </span>
              </div>
              <button
                className="rounded-lg border border-[#B8AA84] px-4 py-2 text-sm font-medium text-[#40503A] transition hover:bg-[#EFE5CD]"
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
