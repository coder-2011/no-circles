import { afterEach, describe, expect, it } from "vitest";
import {
  DEEPGRAM_TOKEN_REUSE_SAFETY_WINDOW_MS,
  DICTATION_WARMUP_COOLDOWN_MS,
  isDeepgramTokenUsable,
  resolveDeepgramTokenExpiryAtMs,
  shouldWarmupDictation
} from "@/app/onboarding/onboarding-config";
import {
  appendTranscript,
  buildFinalDictationTranscript,
  buildDeepgramWebSocketUrl,
  buildDeepgramWebSocketUrlWithoutToken,
  downsampleToMono16k,
  getDeepgramPacketSize,
  int16ToArrayBuffer,
  parseDeepgramMessage,
  updateDeepgramTranscriptState
} from "@/app/onboarding/deepgram-dictation";

const originalWsBase = process.env.NEXT_PUBLIC_DEEPGRAM_WS_BASE;
const originalDeepgramModel = process.env.NEXT_PUBLIC_DEEPGRAM_MODEL;

describe("deepgram-dictation helpers", () => {
  afterEach(() => {
    if (originalWsBase === undefined) {
      delete process.env.NEXT_PUBLIC_DEEPGRAM_WS_BASE;
    } else {
      process.env.NEXT_PUBLIC_DEEPGRAM_WS_BASE = originalWsBase;
    }

    if (originalDeepgramModel === undefined) {
      delete process.env.NEXT_PUBLIC_DEEPGRAM_MODEL;
      return;
    }

    process.env.NEXT_PUBLIC_DEEPGRAM_MODEL = originalDeepgramModel;
  });

  it("builds websocket URL with access token and listen params", () => {
    process.env.NEXT_PUBLIC_DEEPGRAM_WS_BASE = "wss://example.deepgram.test/v1";
    const url = buildDeepgramWebSocketUrl("token_123");

    expect(url).toContain("wss://example.deepgram.test/v1/listen?");
    expect(url).toContain("token=token_123");
    expect(url).toContain("model=nova-3");
    expect(url).toContain("encoding=linear16");
    expect(url).toContain("sample_rate=16000");
  });

  it("supports explicit Deepgram model override", () => {
    process.env.NEXT_PUBLIC_DEEPGRAM_WS_BASE = "wss://example.deepgram.test/v1";
    process.env.NEXT_PUBLIC_DEEPGRAM_MODEL = "nova-2";
    const url = buildDeepgramWebSocketUrl("token_456");
    expect(url).toContain("model=nova-2");
  });

  it("builds websocket URL without token for subprotocol auth fallback", () => {
    process.env.NEXT_PUBLIC_DEEPGRAM_WS_BASE = "wss://example.deepgram.test/v1";
    const url = buildDeepgramWebSocketUrlWithoutToken();
    expect(url).toContain("wss://example.deepgram.test/v1/listen?");
    expect(url).not.toContain("token=");
    expect(url).toContain("encoding=linear16");
  });

  it("appends transcript on a new line", () => {
    expect(appendTranscript("Current line", "Final transcript")).toBe("Current line\nFinal transcript");
    expect(appendTranscript("", "  Spoken text  ")).toBe("Spoken text");
    expect(appendTranscript("Current line", "   ")).toBe("Current line");
  });

  it("downsamples and converts to little-endian linear16 bytes", () => {
    const oneSecondAt48k = new Float32Array(48000);
    for (let index = 0; index < oneSecondAt48k.length; index += 1) {
      oneSecondAt48k[index] = Math.sin((2 * Math.PI * index) / 80);
    }

    const downsampled = downsampleToMono16k(oneSecondAt48k, 48000);
    expect(downsampled.length).toBe(16000);

    const buffer = int16ToArrayBuffer(downsampled);
    expect(buffer.byteLength).toBe(downsampled.length * 2);
  });

  it("parses Deepgram websocket result and error messages", () => {
    const interim = parseDeepgramMessage(
      JSON.stringify({
        type: "Results",
        is_final: false,
        channel: { alternatives: [{ transcript: "hello there" }] }
      })
    );
    expect(interim).toEqual({ kind: "result", transcript: "hello there", isFinal: false });

    const finalResult = parseDeepgramMessage(
      JSON.stringify({
        type: "Results",
        is_final: true,
        channel: { alternatives: [{ transcript: "final chunk" }] }
      })
    );
    expect(finalResult).toEqual({ kind: "result", transcript: "final chunk", isFinal: true });

    const error = parseDeepgramMessage(JSON.stringify({ type: "Error", error: "bad request" }));
    expect(error).toEqual({ kind: "error" });

    const ignore = parseDeepgramMessage("not-json");
    expect(ignore).toEqual({ kind: "ignore" });
  });

  it("accumulates final transcript chunks and keeps interim separate", () => {
    const state1 = updateDeepgramTranscriptState({
      finalTranscript: "",
      interimTranscript: "",
      result: { transcript: "hello", isFinal: false }
    });
    expect(state1).toEqual({ finalTranscript: "", interimTranscript: "hello" });

    const state2 = updateDeepgramTranscriptState({
      finalTranscript: state1.finalTranscript,
      interimTranscript: state1.interimTranscript,
      result: { transcript: "hello world", isFinal: true }
    });
    expect(state2).toEqual({ finalTranscript: "hello world", interimTranscript: "" });

    const state3 = updateDeepgramTranscriptState({
      finalTranscript: state2.finalTranscript,
      interimTranscript: state2.interimTranscript,
      result: { transcript: "second sentence", isFinal: true }
    });
    expect(state3).toEqual({ finalTranscript: "hello world second sentence", interimTranscript: "" });

    expect(buildFinalDictationTranscript(state3.finalTranscript, "tail interim")).toBe(
      "hello world second sentence tail interim"
    );
  });

  it("writes little-endian samples in int16 array buffer", () => {
    const samples = new Int16Array([1, -2]);
    const buffer = int16ToArrayBuffer(samples);
    const bytes = new Uint8Array(buffer);

    expect(Array.from(bytes)).toEqual([1, 0, 254, 255]);
  });

  it("computes packet size at ~200ms", () => {
    expect(getDeepgramPacketSize(48000)).toBe(9600);
    expect(getDeepgramPacketSize(16000)).toBe(3200);
    expect(getDeepgramPacketSize(0)).toBe(0);
  });

  it("resolves token expiry from Deepgram TTL with 30s fallback", () => {
    expect(resolveDeepgramTokenExpiryAtMs({ nowMs: 10_000, expiresInSeconds: 45 })).toBe(55_000);
    expect(resolveDeepgramTokenExpiryAtMs({ nowMs: 10_000, expiresInSeconds: null })).toBe(40_000);
  });

  it("treats cached token as unusable near safety window", () => {
    expect(
      isDeepgramTokenUsable({
        nowMs: 50_000,
        expiresAtMs: 61_001,
        safetyWindowMs: DEEPGRAM_TOKEN_REUSE_SAFETY_WINDOW_MS
      })
    ).toBe(true);
    expect(
      isDeepgramTokenUsable({
        nowMs: 50_000,
        expiresAtMs: 59_999,
        safetyWindowMs: DEEPGRAM_TOKEN_REUSE_SAFETY_WINDOW_MS
      })
    ).toBe(false);
  });

  it("only warms dictation when idle, outside cooldown, and not already ready", () => {
    const baseArgs = {
      dictationState: "idle" as const,
      nowMs: 200_000,
      lastWarmupAtMs: 150_000,
      tokenExpiresAtMs: null,
      tokenRequestInFlight: false,
      moduleRequestInFlight: false,
      cooldownMs: DICTATION_WARMUP_COOLDOWN_MS,
      tokenSafetyWindowMs: DEEPGRAM_TOKEN_REUSE_SAFETY_WINDOW_MS
    };

    expect(shouldWarmupDictation(baseArgs)).toBe(true);
    expect(shouldWarmupDictation({ ...baseArgs, dictationState: "recording" })).toBe(false);
    expect(shouldWarmupDictation({ ...baseArgs, tokenRequestInFlight: true })).toBe(false);
    expect(shouldWarmupDictation({ ...baseArgs, moduleRequestInFlight: true })).toBe(false);
    expect(shouldWarmupDictation({ ...baseArgs, lastWarmupAtMs: 195_000 })).toBe(false);
    expect(shouldWarmupDictation({ ...baseArgs, tokenExpiresAtMs: 240_000 })).toBe(false);
  });
});
