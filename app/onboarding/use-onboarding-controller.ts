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
  INTEREST_QUICK_SPARKS,
  ONBOARDING_PREFS_DRAFT_KEY,
  ONBOARDING_REAUTH_RECOVERY_KEY,
  ONBOARDING_QUICK_SPARKS_DECK_KEY,
  ONBOARDING_QUICK_SPARKS_DRAWER_COUNT,
  ONBOARDING_QUICK_SPARKS_URL,
  ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT,
  parseSendTime,
  PREFERRED_NAME_SUGGESTIONS,
  shuffleQuickSparks,
  type SubmitState,
  truncateToWordLimit
} from "@/app/onboarding/onboarding-config";

type DictationModule = typeof import("@/app/onboarding/deepgram-dictation");

type DictationState = "idle" | "warming" | "recording" | "stopping";

function randomPreferredNameSuggestion(): string {
  const randomIndex = Math.floor(Math.random() * PREFERRED_NAME_SUGGESTIONS.length);
  return PREFERRED_NAME_SUGGESTIONS[randomIndex] ?? PREFERRED_NAME_SUGGESTIONS[0];
}

function resolveSiteOrigin(): string {
  return window.location.origin;
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
  dictationLevels: number[];
  dictationError: string | null;
  quickSparks: string[];
  quickSparksDrawer: string[];
  quickSparksExpanded: boolean;
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
  toggleQuickSparksExpanded: () => void;
  refreshQuickSparks: () => void;
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
  const [dictationLevels, setDictationLevels] = useState<number[]>(() => Array.from({ length: 12 }, () => 0));
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [quickSparks, setQuickSparks] = useState<string[]>(() => [...INTEREST_QUICK_SPARKS]);
  const [quickSparksDrawer, setQuickSparksDrawer] = useState<string[]>([]);
  const [quickSparksExpanded, setQuickSparksExpanded] = useState(false);
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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterAnimationFrameRef = useRef<number | null>(null);
  const dictationLevelsRef = useRef<number[]>(Array.from({ length: 12 }, () => 0));
  const wsRef = useRef<WebSocket | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const pendingSamplesRef = useRef<number[]>([]);
  const dictationStateRef = useRef<DictationState>("idle");
  const brainDumpTextRef = useRef("");
  const dictationModuleRef = useRef<DictationModule | null>(null);
  const quickSparksPoolRef = useRef<string[]>([...INTEREST_QUICK_SPARKS]);
  const quickSparksUnseenRef = useRef<string[]>([]);
  const quickSparksSeenRef = useRef<string[]>([]);

  const brainDumpWordCount = countWords(brainDumpText);

  function setDictationMode(nextState: DictationState) {
    dictationStateRef.current = nextState;
    setDictationState(nextState);
  }

  useEffect(() => {
    dictationStateRef.current = dictationState;
  }, [dictationState]);

  useEffect(() => {
    dictationLevelsRef.current = dictationLevels;
  }, [dictationLevels]);

  useEffect(() => {
    brainDumpTextRef.current = brainDumpText;
  }, [brainDumpText]);

  function setBrainDumpText(value: string) {
    setBrainDumpTextState(truncateToWordLimit(value, BRAIN_DUMP_WORD_LIMIT));
  }

  async function getDictationModule(): Promise<DictationModule> {
    if (dictationModuleRef.current) {
      return dictationModuleRef.current;
    }

    const loadedDictationModule = await import("@/app/onboarding/deepgram-dictation");
    dictationModuleRef.current = loadedDictationModule;
    return loadedDictationModule;
  }

  useEffect(() => {
    const inferredName = getPreferredNameFromEmail(email);
    if (inferredName) {
      setPreferredNameSuggestion(inferredName);
      return;
    }

    setPreferredNameSuggestion(fallbackPreferredNameSuggestion);
  }, [email, fallbackPreferredNameSuggestion]);

  useEffect(() => {
    const savedPrefs = window.localStorage.getItem(ONBOARDING_PREFS_DRAFT_KEY);
    if (!savedPrefs) {
      return;
    }

    let parsed:
      | {
          preferredName?: string;
          timezone?: string;
          sendHour12?: string;
          sendMinute?: string;
          sendMeridiem?: "AM" | "PM";
        }
      | null = null;
    try {
      parsed = JSON.parse(savedPrefs) as {
        preferredName?: string;
        timezone?: string;
        sendHour12?: string;
        sendMinute?: string;
        sendMeridiem?: "AM" | "PM";
      };
    } catch {
      window.localStorage.removeItem(ONBOARDING_PREFS_DRAFT_KEY);
      return;
    }

    if (!parsed) {
      return;
    }

    if (typeof parsed.preferredName === "string") {
      setPreferredName(parsed.preferredName);
    }
    if (typeof parsed.timezone === "string" && parsed.timezone.trim()) {
      setTimezone(parsed.timezone);
    }
    if (typeof parsed.sendHour12 === "string" && parsed.sendHour12.trim()) {
      setSendHour12(parsed.sendHour12);
    }
    if (typeof parsed.sendMinute === "string" && parsed.sendMinute.trim()) {
      setSendMinute(parsed.sendMinute);
    }
    if (parsed.sendMeridiem === "AM" || parsed.sendMeridiem === "PM") {
      setSendMeridiem(parsed.sendMeridiem);
    }
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

    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(BRAIN_DUMP_DRAFT_KEY, brainDumpText);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [brainDumpText]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(
        ONBOARDING_PREFS_DRAFT_KEY,
        JSON.stringify({
          preferredName,
          timezone,
          sendHour12,
          sendMinute,
          sendMeridiem
        })
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [preferredName, timezone, sendHour12, sendMinute, sendMeridiem]);

  useEffect(() => {
    let mounted = true;
    const timeout = window.setTimeout(() => {
      void fetch(ONBOARDING_QUICK_SPARKS_URL)
        .then((response) => (response.ok ? response.text() : null))
        .then((text) => {
          if (!mounted || !text) {
            return;
          }

          const parsed = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          if (parsed.length === 0) {
            return;
          }
          quickSparksPoolRef.current = parsed;
          const allSet = new Set(parsed);
          const savedDeckRaw = window.localStorage.getItem(ONBOARDING_QUICK_SPARKS_DECK_KEY);
          let unseen = [] as string[];
          let seen = [] as string[];

          if (savedDeckRaw) {
            try {
              const parsedDeck = JSON.parse(savedDeckRaw) as { unseen?: string[]; seen?: string[] };
              const unseenCandidate = Array.isArray(parsedDeck.unseen) ? parsedDeck.unseen.filter((item) => allSet.has(item)) : [];
              const seenCandidate = Array.isArray(parsedDeck.seen) ? parsedDeck.seen.filter((item) => allSet.has(item)) : [];
              const dedupe = new Set<string>();
              unseen = unseenCandidate.filter((item) => {
                if (dedupe.has(item)) {
                  return false;
                }
                dedupe.add(item);
                return true;
              });
              seen = seenCandidate.filter((item) => {
                if (dedupe.has(item)) {
                  return false;
                }
                dedupe.add(item);
                return true;
              });
            } catch {
              unseen = [];
              seen = [];
            }
          }

          if (unseen.length + seen.length < parsed.length) {
            const existing = new Set([...unseen, ...seen]);
            const missing = parsed.filter((item) => !existing.has(item));
            unseen = [...unseen, ...shuffleQuickSparks(missing)];
          }

          if (unseen.length === 0 && seen.length > 0) {
            unseen = shuffleQuickSparks(seen);
            seen = [];
          }

          quickSparksUnseenRef.current = unseen;
          quickSparksSeenRef.current = seen;
          const requested = ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT + ONBOARDING_QUICK_SPARKS_DRAWER_COUNT;
          const batch: string[] = [];
          while (batch.length < requested && quickSparksPoolRef.current.length > 0) {
            if (quickSparksUnseenRef.current.length === 0) {
              if (quickSparksSeenRef.current.length === 0) {
                break;
              }
              quickSparksUnseenRef.current = shuffleQuickSparks(quickSparksSeenRef.current);
              quickSparksSeenRef.current = [];
            }

            const next = quickSparksUnseenRef.current.shift();
            if (!next) {
              break;
            }
            batch.push(next);
            quickSparksSeenRef.current.push(next);
          }

          if (batch.length > 0) {
            setQuickSparks(batch.slice(0, ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT));
            setQuickSparksDrawer(batch.slice(ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT));
            window.localStorage.setItem(
              ONBOARDING_QUICK_SPARKS_DECK_KEY,
              JSON.stringify({
                unseen: quickSparksUnseenRef.current,
                seen: quickSparksSeenRef.current
              })
            );
          }
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, []);

  function persistQuickSparksDeck() {
    window.localStorage.setItem(
      ONBOARDING_QUICK_SPARKS_DECK_KEY,
      JSON.stringify({
        unseen: quickSparksUnseenRef.current,
        seen: quickSparksSeenRef.current
      })
    );
  }

  function pullQuickSparks(count: number): string[] {
    const selected: string[] = [];
    while (selected.length < count && quickSparksPoolRef.current.length > 0) {
      if (quickSparksUnseenRef.current.length === 0) {
        if (quickSparksSeenRef.current.length === 0) {
          break;
        }
        quickSparksUnseenRef.current = shuffleQuickSparks(quickSparksSeenRef.current);
        quickSparksSeenRef.current = [];
      }

      const next = quickSparksUnseenRef.current.shift();
      if (!next) {
        break;
      }
      selected.push(next);
      quickSparksSeenRef.current.push(next);
    }

    return selected;
  }

  function rotateQuickSparksBatch() {
    const requested = ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT + ONBOARDING_QUICK_SPARKS_DRAWER_COUNT;
    const batch = pullQuickSparks(requested);
    if (batch.length === 0) {
      return;
    }

    setQuickSparks(batch.slice(0, ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT));
    setQuickSparksDrawer(batch.slice(ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT));
    persistQuickSparksDeck();
  }

  function refreshQuickSparks() {
    rotateQuickSparksBatch();
  }

  function toggleQuickSparksExpanded() {
    setQuickSparksExpanded((current) => !current);
  }

  useEffect(() => {
    if (!authClient.initError) {
      return;
    }

    setAuthState("error");
    setMessage(authClient.initError);
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
        setMessage(error.message);
        return;
      }

      const sessionEmail = data.session?.user?.email;
      if (sessionEmail) {
        setEmail(sessionEmail);
        setAuthState("signed_in");
        if (window.localStorage.getItem(ONBOARDING_REAUTH_RECOVERY_KEY) === "1") {
          window.localStorage.removeItem(ONBOARDING_REAUTH_RECOVERY_KEY);
          setMessage("Session restored. Your onboarding draft was recovered.");
        }
      } else {
        setAuthState("signed_out");
      }
    });

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function signInWithGoogle() {
    if (!supabase) {
      return;
    }

    setMessage(null);
    const callbackUrl = new URL("/auth/callback", resolveSiteOrigin());
    callbackUrl.searchParams.set("next", "/onboarding");
    callbackUrl.searchParams.set("callback_origin", window.location.origin);
    const redirectTo = callbackUrl.toString();
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

    router.replace("/");
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
      window.localStorage.removeItem(BRAIN_DUMP_DRAFT_KEY);
      window.localStorage.removeItem(ONBOARDING_PREFS_DRAFT_KEY);
      router.replace("/#top");
      return;
    }

    setSubmitState("error");
    if (response.status === 401) {
      setMessage("Your session expired. Redirecting to sign in...");
      setAuthState("signed_out");
      window.localStorage.setItem(ONBOARDING_REAUTH_RECOVERY_KEY, "1");
      void signInWithGoogle();
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
    setDictationLevels(Array.from({ length: 12 }, () => 0.08));
    setDictationMode("warming");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) {
      setDictationMode("idle");
      setDictationLevels(Array.from({ length: 12 }, () => 0));
      setDictationError("Microphone access failed. Check browser permissions and try again.");
      return;
    }

    const tokenResponse = await fetch("/api/deepgram/token", { method: "GET" }).catch(() => null);
    const tokenRawBody = await tokenResponse?.text().catch(() => null);
    let tokenBody: { ok: true; access_token: string } | { ok: false; message?: string } | null = null;
    if (tokenRawBody) {
      try {
        tokenBody = JSON.parse(tokenRawBody) as { ok: true; access_token: string } | { ok: false; message?: string };
      } catch {
        tokenBody = null;
      }
    }

    if (!tokenResponse?.ok || !tokenBody || !("ok" in tokenBody) || tokenBody.ok !== true || !tokenBody.access_token) {
      stream.getTracks().forEach((track) => track.stop());
      setDictationMode("idle");
      setDictationLevels(Array.from({ length: 12 }, () => 0));
      const serverMessage = tokenBody && "ok" in tokenBody && tokenBody.ok === false ? tokenBody.message : null;
      if (serverMessage) {
        setDictationError(serverMessage);
        return;
      }

      if (!tokenResponse) {
        setDictationError("Failed to issue token. Could not reach /api/deepgram/token.");
        return;
      }

      setDictationError(`Failed to issue token (HTTP ${tokenResponse.status}).`);
      return;
    }
    const accessToken = tokenBody.access_token;
    const dictationModule = await getDictationModule().catch(() => null);
    if (!dictationModule) {
      stream.getTracks().forEach((track) => track.stop());
      setDictationMode("idle");
      setDictationLevels(Array.from({ length: 12 }, () => 0));
      setDictationError("Failed to load dictation runtime. Refresh and try again.");
      return;
    }

    const connectionAttempt = await connectDeepgramWebSocket(accessToken, dictationModule);
    if (!connectionAttempt.ws) {
      stream.getTracks().forEach((track) => track.stop());
      setDictationMode("idle");
      setDictationLevels(Array.from({ length: 12 }, () => 0));
      const reason = connectionAttempt.reason ? ` ${connectionAttempt.reason}.` : "";
      setDictationError(`Could not connect to dictation server.${reason}`);
      return;
    }

    const ws = connectionAttempt.ws;
    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(16384, 1, 1);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.68;

    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    audioSourceRef.current = audioSource;
    processorRef.current = processor;
    analyserRef.current = analyser;
    wsRef.current = ws;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    pendingSamplesRef.current = [];

    ws.onmessage = (event) => {
      const parsed = dictationModule.parseDeepgramMessage(String(event.data));
      if (parsed.kind === "ignore") {
        return;
      }

      if (parsed.kind === "error") {
        setDictationError("Deepgram dictation returned an error. Please retry.");
        return;
      }

      const nextTranscriptState = dictationModule.updateDeepgramTranscriptState({
        finalTranscript: finalTranscriptRef.current,
        interimTranscript: interimTranscriptRef.current,
        result: { transcript: parsed.transcript, isFinal: parsed.isFinal }
      });
      finalTranscriptRef.current = nextTranscriptState.finalTranscript;
      interimTranscriptRef.current = nextTranscriptState.interimTranscript;
    };

    audioSource.connect(processor);
    audioSource.connect(analyser);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const channelData = event.inputBuffer.getChannelData(0);
      const pending = pendingSamplesRef.current;
      for (let index = 0; index < channelData.length; index += 1) {
        const sample = channelData[index] ?? 0;
        pending.push(sample);
      }

      const chunkSize = dictationModule.getDeepgramPacketSize(audioContext.sampleRate);
      if (chunkSize <= 0) {
        return;
      }
      while (pending.length >= chunkSize) {
        const oneSecondInput = pending.splice(0, chunkSize);
        const pcm16 = dictationModule.downsampleToMono16k(Float32Array.from(oneSecondInput), audioContext.sampleRate);
        if (pcm16.length === 0) {
          continue;
        }

        ws.send(dictationModule.int16ToArrayBuffer(pcm16));
      }
    };

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const renderMeter = () => {
      const currentAnalyser = analyserRef.current;
      if (!currentAnalyser || dictationStateRef.current !== "recording") {
        meterAnimationFrameRef.current = null;
        return;
      }

      currentAnalyser.getByteFrequencyData(frequencyData);
      const barCount = dictationLevelsRef.current.length;
      const previous = dictationLevelsRef.current;
      const nextRaw = new Array<number>(barCount);
      const nyquistHz = audioContext.sampleRate / 2;
      const speechMinHz = 80;
      const speechMaxHz = 5200;
      const maxIndex = Math.max(1, frequencyData.length - 1);
      const minBin = Math.max(1, Math.floor((speechMinHz / nyquistHz) * maxIndex));
      const maxBin = Math.max(minBin + 1, Math.min(maxIndex, Math.floor((speechMaxHz / nyquistHz) * maxIndex)));

      let fullBandSum = 0;
      for (let index = minBin; index <= maxBin; index += 1) {
        fullBandSum += frequencyData[index] ?? 0;
      }
      const fullBandEnergy = Math.min(1, Math.max(0, fullBandSum / Math.max(1, maxBin - minBin + 1) / 255));

      for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
        const startRatio = Math.pow(barIndex / barCount, 1.8);
        const endRatio = Math.pow((barIndex + 1) / barCount, 1.8);
        const start = minBin + Math.floor((maxBin - minBin) * startRatio);
        const end = Math.min(maxBin + 1, minBin + Math.floor((maxBin - minBin) * endRatio) + 1);
        let sum = 0;
        let peak = 0;
        for (let index = start; index < end; index += 1) {
          const value = frequencyData[index] ?? 0;
          sum += value;
          if (value > peak) {
            peak = value;
          }
        }

        const average = sum / Math.max(1, end - start) / 255;
        const peakNormalized = peak / 255;
        const bandEnergy = average * 0.68 + peakNormalized * 0.32;
        const sharedEnergy = fullBandEnergy * 0.12;
        const adaptiveGain = 1.28 + (1 - fullBandEnergy) * 0.62;
        const normalized = Math.min(1, Math.max(0, (bandEnergy + sharedEnergy) * adaptiveGain));
        const compressed = Math.log1p(normalized * 5) / Math.log1p(5);
        const target = 0.06 + compressed * 0.88;
        const smoothed = previous[barIndex] * 0.56 + target * 0.44;
        nextRaw[barIndex] = smoothed;
      }

      const next = nextRaw.map((value, index) => {
        const left = index > 0 ? nextRaw[index - 1] : value;
        const right = index < nextRaw.length - 1 ? nextRaw[index + 1] : value;
        return value * 0.82 + (left + right) * 0.09;
      });

      setDictationLevels(next);
      meterAnimationFrameRef.current = window.requestAnimationFrame(renderMeter);
    };

    setDictationMode("recording");
    meterAnimationFrameRef.current = window.requestAnimationFrame(renderMeter);
  }

  async function connectDeepgramWebSocket(
    accessToken: string,
    dictationModule: DictationModule
  ): Promise<{ ws: WebSocket | null; reason: string | null }> {
    const queryAttempt = await attemptWebSocketOpen(dictationModule.buildDeepgramWebSocketUrl(accessToken));
    if (queryAttempt.ws) {
      return queryAttempt;
    }

    const subprotocolAttempt = await attemptWebSocketOpen(dictationModule.buildDeepgramWebSocketUrlWithoutToken(), [
      "token",
      accessToken
    ]);
    if (subprotocolAttempt.ws) {
      return subprotocolAttempt;
    }

    const clientApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_CLIENT_API_KEY?.trim();
    if (clientApiKey) {
      const clientKeyAttempt = await attemptWebSocketOpen(dictationModule.buildDeepgramWebSocketUrlWithoutToken(), [
        "token",
        clientApiKey
      ]);
      if (clientKeyAttempt.ws) {
        return clientKeyAttempt;
      }

      const reason = clientKeyAttempt.reason ?? subprotocolAttempt.reason ?? queryAttempt.reason ?? null;
      return { ws: null, reason };
    }

    const reason = subprotocolAttempt.reason ?? queryAttempt.reason ?? null;
    return { ws: null, reason };
  }

  async function attemptWebSocketOpen(url: string, protocols?: string[]): Promise<{ ws: WebSocket | null; reason: string | null }> {
    const ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);

    const result = await new Promise<{ opened: boolean; reason: string | null }>((resolve) => {
      let resolved = false;
      const finish = (value: { opened: boolean; reason: string | null }) => {
        if (resolved) {
          return;
        }

        resolved = true;
        resolve(value);
      };
      const timeout = window.setTimeout(
        () => finish({ opened: false, reason: "connection timeout (10s)" }),
        10000
      );
      ws.onopen = () => {
        window.clearTimeout(timeout);
        finish({ opened: true, reason: null });
      };
      ws.onerror = () => {
        window.setTimeout(() => {
          if (!resolved) {
            window.clearTimeout(timeout);
            finish({ opened: false, reason: "websocket error event" });
          }
        }, 300);
      };
      ws.onclose = (event) => {
        window.clearTimeout(timeout);
        finish({
          opened: false,
          reason: `close code ${event.code}${event.reason ? ` (${event.reason})` : ""}`
        });
      };
    });

    if (result.opened) {
      return { ws, reason: null };
    }

    try {
      ws.close();
    } catch {
      // no-op
    }

    return { ws: null, reason: result.reason };
  }

  async function stopDictation() {
    if (dictationStateRef.current === "idle") {
      return;
    }

    setDictationMode("stopping");

    const processor = processorRef.current;
    const source = audioSourceRef.current;
    const audioContext = audioContextRef.current;
    const analyser = analyserRef.current;
    const mediaStream = mediaStreamRef.current;
    const ws = wsRef.current;
    const meterAnimationFrame = meterAnimationFrameRef.current;

    processorRef.current = null;
    audioSourceRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaStreamRef.current = null;
    wsRef.current = null;
    meterAnimationFrameRef.current = null;

    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
    }

    if (source) {
      source.disconnect();
    }

    if (analyser) {
      analyser.disconnect();
    }

    if (meterAnimationFrame !== null) {
      window.cancelAnimationFrame(meterAnimationFrame);
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
    const dictationModule = dictationModuleRef.current;
    if (!dictationModule) {
      pendingSamplesRef.current = [];
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      setDictationLevels(Array.from({ length: 12 }, () => 0));
      setDictationMode("idle");
      return;
    }

    const nextText = dictationModule.appendTranscript(
      currentBrainDumpText,
      dictationModule.buildFinalDictationTranscript(finalTranscriptRef.current, interimTranscriptRef.current)
    );
    if (nextText !== currentBrainDumpText) {
      setBrainDumpText(truncateToWordLimit(nextText, BRAIN_DUMP_WORD_LIMIT));
    }

    pendingSamplesRef.current = [];
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setDictationLevels(Array.from({ length: 12 }, () => 0));
    setDictationMode("idle");
  }

  useEffect(() => {
    return () => {
      const processor = processorRef.current;
      const source = audioSourceRef.current;
      const audioContext = audioContextRef.current;
      const analyser = analyserRef.current;
      const mediaStream = mediaStreamRef.current;
      const ws = wsRef.current;
      const meterAnimationFrame = meterAnimationFrameRef.current;

      processorRef.current = null;
      audioSourceRef.current = null;
      audioContextRef.current = null;
      analyserRef.current = null;
      mediaStreamRef.current = null;
      wsRef.current = null;
      meterAnimationFrameRef.current = null;

      if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
      }

      if (source) {
        source.disconnect();
      }

      if (analyser) {
        analyser.disconnect();
      }

      if (meterAnimationFrame !== null) {
        window.cancelAnimationFrame(meterAnimationFrame);
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
    dictationLevels,
    dictationError,
    quickSparks,
    quickSparksDrawer,
    quickSparksExpanded,
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
    toggleQuickSparksExpanded,
    refreshQuickSparks,
    startDictation,
    stopDictation
  };
}
