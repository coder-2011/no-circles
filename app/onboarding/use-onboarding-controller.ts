"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  appendTranscript,
  buildWisprWarmupUrl,
  buildWisprWebSocketUrl,
  downsampleToMono16k,
  encodePcm16WavBase64,
  getWisprAccessToken,
  getWisprClientKey
} from "@/app/onboarding/wispr-dictation";

type DictationState = "idle" | "warming" | "recording" | "stopping";

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
  dictationState: DictationState;
  dictationError: string | null;
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
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const packetCountRef = useRef(0);
  const transcriptRef = useRef("");
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

  async function startDictation() {
    if (dictationStateRef.current !== "idle") {
      return;
    }

    const clientKey = getWisprClientKey();
    if (!clientKey) {
      setDictationError("Dictation is not configured (missing NEXT_PUBLIC_WISPR_CLIENT_KEY).");
      return;
    }

    setDictationError(null);
    setDictationState("warming");
    const accessToken = getWisprAccessToken() ?? clientKey;

    try {
      await fetch(buildWisprWarmupUrl(), {
        method: "GET",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
    } catch {
      // Warmup is best-effort; we still continue with websocket startup.
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) {
      setDictationState("idle");
      setDictationError("Microphone access failed. Check browser permissions and try again.");
      return;
    }

    const ws = new WebSocket(buildWisprWebSocketUrl(clientKey));
    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    audioSourceRef.current = audioSource;
    processorRef.current = processor;
    wsRef.current = ws;
    packetCountRef.current = 0;
    transcriptRef.current = "";
    pendingSamplesRef.current = [];

    const authenticated = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 5000);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "auth",
            access_token: accessToken,
            language: ["en"],
            context: {
              app: { name: "Serendipitous Encounters", type: "email" }
            }
          })
        );
      };

      ws.onmessage = (event) => {
        let payload: { status?: string; final?: boolean; body?: { text?: string } } | undefined;
        try {
          payload = JSON.parse(String(event.data)) as { status?: string; final?: boolean; body?: { text?: string } };
        } catch {
          return;
        }
        if (!payload) {
          return;
        }

        if (payload.status === "auth") {
          window.clearTimeout(timeout);
          resolve(true);
          return;
        }

        if (payload.status === "text" && payload.body?.text) {
          transcriptRef.current = payload.body.text;
        }
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        resolve(false);
      };

      ws.onclose = () => {
        window.clearTimeout(timeout);
      };
    });

    if (!authenticated) {
      await stopDictation();
      setDictationError("Could not start dictation session.");
      return;
    }

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

      const chunkSize = Math.floor(audioContext.sampleRate);
      while (pending.length >= chunkSize) {
        const oneSecondInput = pending.splice(0, chunkSize);
        const pcm16 = downsampleToMono16k(Float32Array.from(oneSecondInput), audioContext.sampleRate);
        if (pcm16.length === 0) {
          continue;
        }

        ws.send(
          JSON.stringify({
            type: "append",
            position: packetCountRef.current,
            audio_packets: {
              packets: [encodePcm16WavBase64(pcm16)],
              volumes: [1],
              packet_duration: 1,
              audio_encoding: "wav",
              byte_encoding: "base64"
            }
          })
        );
        packetCountRef.current += 1;
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
      ws.send(
        JSON.stringify({
          type: "commit",
          total_packets: packetCountRef.current
        })
      );

      await new Promise((resolve) => window.setTimeout(resolve, 900));
      ws.close();
    }

    const currentBrainDumpText = brainDumpTextRef.current;
    const nextText = appendTranscript(currentBrainDumpText, transcriptRef.current);
    if (nextText !== currentBrainDumpText) {
      setBrainDumpText(truncateToWordLimit(nextText, BRAIN_DUMP_WORD_LIMIT));
    }

    pendingSamplesRef.current = [];
    packetCountRef.current = 0;
    transcriptRef.current = "";
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
    signInWithGoogle,
    signOut,
    submitOnboarding,
    appendQuickSpark,
    startDictation,
    stopDictation
  };
}
