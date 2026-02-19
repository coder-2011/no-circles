"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/auth/browser-client";
import {
  BRAIN_DUMP_DRAFT_KEY,
  BRAIN_DUMP_WORD_LIMIT,
  buildTimezoneOptions,
  buildSendTime,
  countWords,
  type AuthState,
  getDetectedTimezone,
  getPreferredNameFromEmail,
  initialSendTimeFromLocalNow,
  parseSendTime,
  PREFERRED_NAME_SUGGESTIONS,
  type SubmitState,
  truncateToWordLimit
} from "@/app/onboarding/onboarding-config";
import {
  appendTranscript,
  buildFinalDictationTranscript,
  buildDeepgramWebSocketUrl,
  downsampleToMono16k,
  getDeepgramPacketSize,
  int16ToArrayBuffer,
  parseDeepgramMessage,
  updateDeepgramTranscriptState
} from "@/app/onboarding/deepgram-dictation";

type DictationState = "idle" | "warming" | "recording" | "stopping";

function randomPreferredNameSuggestion(): string {
  const randomIndex = Math.floor(Math.random() * PREFERRED_NAME_SUGGESTIONS.length);
  return PREFERRED_NAME_SUGGESTIONS[randomIndex] ?? PREFERRED_NAME_SUGGESTIONS[0];
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
  timezoneOptions: string[];
  sendHour12: string;
  sendMinute: string;
  sendMeridiem: "AM" | "PM";
  sendTime: string;
  brainDumpText: string;
  brainDumpWordCount: number;
  dictationState: DictationState;
  dictationError: string | null;
  setPreferredName: (value: string) => void;
  setTimezone: (value: string) => void;
  setSendHour12: (value: string) => void;
  setSendMinute: (value: string) => void;
  setSendMeridiem: (value: "AM" | "PM") => void;
  setBrainDumpText: (value: string) => void;
  completePreferredNameOnTab: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  submitOnboarding: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  appendQuickSpark: (spark: string) => void;
  startDictation: () => Promise<void>;
  stopDictation: () => Promise<void>;
};

export function useOnboardingController(): OnboardingController {
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [dictationState, setDictationState] = useState<DictationState>("idle");
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [preferredName, setPreferredName] = useState("");
  const [fallbackPreferredNameSuggestion] = useState(randomPreferredNameSuggestion);
  const [preferredNameSuggestion, setPreferredNameSuggestion] = useState(fallbackPreferredNameSuggestion);
  const [timezone, setTimezone] = useState(getDetectedTimezone);
  const timezoneOptions = useMemo(() => buildTimezoneOptions(timezone), [timezone]);

  const defaultSendParts = useMemo(() => parseSendTime(initialSendTimeFromLocalNow()), []);
  const [sendHour12, setSendHour12] = useState(defaultSendParts.hour12);
  const [sendMinute, setSendMinute] = useState(defaultSendParts.minute);
  const [sendMeridiem, setSendMeridiem] = useState<"AM" | "PM">(defaultSendParts.meridiem);
  const sendTime = useMemo(
    () => buildSendTime(sendHour12, sendMinute, sendMeridiem),
    [sendHour12, sendMinute, sendMeridiem]
  );

  const [brainDumpText, setBrainDumpTextState] = useState("");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const pendingSamplesRef = useRef<number[]>([]);
  const dictationStateRef = useRef<DictationState>("idle");
  const brainDumpTextRef = useRef("");

  const brainDumpWordCount = countWords(brainDumpText);

  useEffect(() => {
    dictationStateRef.current = dictationState;
  }, [dictationState]);

  useEffect(() => {
    brainDumpTextRef.current = brainDumpText;
  }, [brainDumpText]);

  function setBrainDumpText(value: string) {
    setBrainDumpTextState(truncateToWordLimit(value, BRAIN_DUMP_WORD_LIMIT));
  }

  useEffect(() => {
    const inferredName = getPreferredNameFromEmail(email);
    if (inferredName) {
      setPreferredNameSuggestion(inferredName);
      setPreferredName((current) => (current.trim() ? current : inferredName));
      return;
    }

    setPreferredNameSuggestion(fallbackPreferredNameSuggestion);
  }, [email, fallbackPreferredNameSuggestion]);

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
    await stopDictation();

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

  function completePreferredNameOnTab(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const suggestion = preferredNameSuggestion.trim();
    if (!suggestion) {
      return;
    }

    const typed = preferredName.trim();
    if (!typed) {
      setPreferredName(suggestion);
      return;
    }

    const typedLower = typed.toLowerCase();
    const suggestionLower = suggestion.toLowerCase();
    if (!suggestionLower.startsWith(typedLower) || typedLower === suggestionLower) {
      return;
    }

    event.preventDefault();
    setPreferredName(suggestion);
  }

  async function startDictation() {
    if (dictationStateRef.current !== "idle") {
      return;
    }

    setDictationError(null);
    setDictationState("warming");
    const tokenResponse = await fetch("/api/deepgram/token", { method: "GET" }).catch(() => null);
    const tokenBody = (await tokenResponse?.json().catch(() => null)) as
      | { ok: true; access_token: string }
      | { ok: false; message?: string }
      | null;

    if (!tokenResponse?.ok || !tokenBody || !("ok" in tokenBody) || tokenBody.ok !== true || !tokenBody.access_token) {
      setDictationState("idle");
      setDictationError("Dictation is not configured (missing DEEPGRAM_API_KEY or auth session).");
      return;
    }
    const accessToken = tokenBody.access_token;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) {
      setDictationState("idle");
      setDictationError("Microphone access failed. Check browser permissions and try again.");
      return;
    }

    const ws = new WebSocket(buildDeepgramWebSocketUrl(accessToken));
    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(16384, 1, 1);

    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    audioSourceRef.current = audioSource;
    processorRef.current = processor;
    wsRef.current = ws;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    pendingSamplesRef.current = [];

    const opened = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 5000);
      ws.onopen = () => {
        window.clearTimeout(timeout);
        resolve(true);
      };
      ws.onerror = () => {
        window.clearTimeout(timeout);
        resolve(false);
      };
      ws.onclose = () => {
        window.clearTimeout(timeout);
      };
    });

    if (!opened) {
      await stopDictation();
      setDictationError("Could not connect to dictation server.");
      return;
    }

    ws.onmessage = (event) => {
      const parsed = parseDeepgramMessage(String(event.data));
      if (parsed.kind === "ignore") {
        return;
      }

      if (parsed.kind === "error") {
        setDictationError("Deepgram dictation returned an error. Please retry.");
        return;
      }

      const nextTranscriptState = updateDeepgramTranscriptState({
        finalTranscript: finalTranscriptRef.current,
        interimTranscript: interimTranscriptRef.current,
        result: { transcript: parsed.transcript, isFinal: parsed.isFinal }
      });
      finalTranscriptRef.current = nextTranscriptState.finalTranscript;
      interimTranscriptRef.current = nextTranscriptState.interimTranscript;
    };

    audioSource.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const channelData = event.inputBuffer.getChannelData(0);
      const pending = pendingSamplesRef.current;
      for (let index = 0; index < channelData.length; index += 1) {
        pending.push(channelData[index] ?? 0);
      }

      const chunkSize = getDeepgramPacketSize(audioContext.sampleRate);
      if (chunkSize <= 0) {
        return;
      }
      while (pending.length >= chunkSize) {
        const oneSecondInput = pending.splice(0, chunkSize);
        const pcm16 = downsampleToMono16k(Float32Array.from(oneSecondInput), audioContext.sampleRate);
        if (pcm16.length === 0) {
          continue;
        }

        ws.send(int16ToArrayBuffer(pcm16));
      }
    };

    setDictationState("recording");
  }

  async function stopDictation() {
    if (dictationStateRef.current === "idle") {
      return;
    }

    setDictationState("stopping");

    const processor = processorRef.current;
    const source = audioSourceRef.current;
    const audioContext = audioContextRef.current;
    const mediaStream = mediaStreamRef.current;
    const ws = wsRef.current;

    processorRef.current = null;
    audioSourceRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;
    wsRef.current = null;

    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
    }

    if (source) {
      source.disconnect();
    }

    if (audioContext) {
      void audioContext.close();
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "Finalize" }));
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      ws.send(JSON.stringify({ type: "CloseStream" }));
      ws.close(1000, "dictation-finished");
    }

    const currentBrainDumpText = brainDumpTextRef.current;
    const nextText = appendTranscript(
      currentBrainDumpText,
      buildFinalDictationTranscript(finalTranscriptRef.current, interimTranscriptRef.current)
    );
    if (nextText !== currentBrainDumpText) {
      setBrainDumpText(truncateToWordLimit(nextText, BRAIN_DUMP_WORD_LIMIT));
    }

    pendingSamplesRef.current = [];
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setDictationState("idle");
  }

  useEffect(() => {
    return () => {
      const processor = processorRef.current;
      const source = audioSourceRef.current;
      const audioContext = audioContextRef.current;
      const mediaStream = mediaStreamRef.current;
      const ws = wsRef.current;

      processorRef.current = null;
      audioSourceRef.current = null;
      audioContextRef.current = null;
      mediaStreamRef.current = null;
      wsRef.current = null;

      if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
      }

      if (source) {
        source.disconnect();
      }

      if (audioContext) {
        void audioContext.close();
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return {
    authState,
    email,
    submitState,
    message,
    showCelebration,
    preferredName,
    preferredNameSuggestion,
    timezone,
    timezoneOptions,
    sendHour12,
    sendMinute,
    sendMeridiem,
    sendTime,
    brainDumpText,
    brainDumpWordCount,
    dictationState,
    dictationError,
    setPreferredName,
    setTimezone,
    setSendHour12,
    setSendMinute,
    setSendMeridiem,
    setBrainDumpText,
    completePreferredNameOnTab,
    signInWithGoogle,
    signOut,
    submitOnboarding,
    appendQuickSpark,
    startDictation,
    stopDictation
  };
}
