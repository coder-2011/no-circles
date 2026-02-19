"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import {
  BRAIN_DUMP_DRAFT_KEY,
  BRAIN_DUMP_WORD_LIMIT,
  buildSendTime,
  countWords,
  CURATED_TIMEZONES,
  type AuthState,
  parseSendTime,
  PREFERRED_NAME_SUGGESTIONS,
  type SubmitState,
  truncateToWordLimit
} from "@/app/onboarding/onboarding-config";

function initialTimezone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return CURATED_TIMEZONES.includes(detected as (typeof CURATED_TIMEZONES)[number]) ? detected : "America/New_York";
}

export type OnboardingController = {
  authState: AuthState;
  email: string | null;
  submitState: SubmitState;
  message: string | null;
  showCelebration: boolean;
  preferredName: string;
  preferredNameSuggestion: string;
  timezone: string;
  sendHour12: string;
  sendMinute: string;
  sendMeridiem: "AM" | "PM";
  sendTime: string;
  brainDumpText: string;
  brainDumpWordCount: number;
  setPreferredName: (value: string) => void;
  setTimezone: (value: string) => void;
  setSendHour12: (value: string) => void;
  setSendMinute: (value: string) => void;
  setSendMeridiem: (value: "AM" | "PM") => void;
  setBrainDumpText: (value: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  submitOnboarding: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  appendQuickSpark: (spark: string) => void;
};

export function useOnboardingController(): OnboardingController {
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [preferredName, setPreferredName] = useState("");
  const [preferredNameSuggestion, setPreferredNameSuggestion] = useState(PREFERRED_NAME_SUGGESTIONS[0]);
  const [timezone, setTimezone] = useState(initialTimezone);

  const defaultSendParts = useMemo(() => parseSendTime("08:00"), []);
  const [sendHour12, setSendHour12] = useState(defaultSendParts.hour12);
  const [sendMinute, setSendMinute] = useState(defaultSendParts.minute);
  const [sendMeridiem, setSendMeridiem] = useState<"AM" | "PM">(defaultSendParts.meridiem);
  const sendTime = useMemo(
    () => buildSendTime(sendHour12, sendMinute, sendMeridiem),
    [sendHour12, sendMinute, sendMeridiem]
  );

  const [brainDumpText, setBrainDumpTextState] = useState("");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  const brainDumpWordCount = countWords(brainDumpText);

  function setBrainDumpText(value: string) {
    setBrainDumpTextState(truncateToWordLimit(value, BRAIN_DUMP_WORD_LIMIT));
  }

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * PREFERRED_NAME_SUGGESTIONS.length);
    setPreferredNameSuggestion(PREFERRED_NAME_SUGGESTIONS[randomIndex]);
  }, []);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(BRAIN_DUMP_DRAFT_KEY);
    if (savedDraft) {
      setBrainDumpText(savedDraft);
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
      if (!mounted) {
        return;
      }

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
    if (!supabase) {
      return;
    }

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
    if (!supabase) {
      return;
    }

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
    setBrainDumpTextState((current) => {
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

  return {
    authState,
    email,
    submitState,
    message,
    showCelebration,
    preferredName,
    preferredNameSuggestion,
    timezone,
    sendHour12,
    sendMinute,
    sendMeridiem,
    sendTime,
    brainDumpText,
    brainDumpWordCount,
    setPreferredName,
    setTimezone,
    setSendHour12,
    setSendMinute,
    setSendMeridiem,
    setBrainDumpText,
    signInWithGoogle,
    signOut,
    submitOnboarding,
    appendQuickSpark
  };
}
