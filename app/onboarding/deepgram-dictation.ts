"use client";

const DEFAULT_DEEPGRAM_WS_BASE = "wss://api.deepgram.com/v1";
const DEFAULT_DEEPGRAM_MODEL = "nova-3";
const DEEPGRAM_TARGET_SAMPLE_RATE = 16000;
const DEEPGRAM_PACKET_MS = 200;

export function buildDeepgramWebSocketUrl(accessToken: string): string {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_WS_BASE?.trim() || DEFAULT_DEEPGRAM_WS_BASE;
  const model = process.env.NEXT_PUBLIC_DEEPGRAM_MODEL?.trim() || DEFAULT_DEEPGRAM_MODEL;
  const params = new URLSearchParams({
    access_token: accessToken,
    model,
    encoding: "linear16",
    sample_rate: String(DEEPGRAM_TARGET_SAMPLE_RATE),
    channels: "1",
    interim_results: "true",
    punctuate: "true",
    smart_format: "true"
  });

  return `${base.replace(/\/$/, "")}/listen?${params.toString()}`;
}

export function getDeepgramPacketSize(inputSampleRate: number): number {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor((inputSampleRate * DEEPGRAM_PACKET_MS) / 1000));
}

export function appendTranscript(currentText: string, transcript: string): string {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) {
    return currentText;
  }

  const normalizedCurrent = currentText.trimEnd();
  return normalizedCurrent ? `${normalizedCurrent}\n${cleanTranscript}` : cleanTranscript;
}

export type DeepgramMessageParseResult =
  | { kind: "result"; transcript: string; isFinal: boolean }
  | { kind: "error" }
  | { kind: "ignore" };

type DeepgramResultsPayload = {
  type?: string;
  is_final?: boolean;
  channel?: { alternatives?: Array<{ transcript?: string }> };
  error?: string;
};

export function parseDeepgramMessage(rawMessage: string): DeepgramMessageParseResult {
  let payload: DeepgramResultsPayload | undefined;
  try {
    payload = JSON.parse(rawMessage) as DeepgramResultsPayload;
  } catch {
    return { kind: "ignore" };
  }

  if (!payload) {
    return { kind: "ignore" };
  }

  if (payload.type === "Error" || payload.error) {
    return { kind: "error" };
  }

  const transcript = payload.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (payload.type !== "Results" || !transcript) {
    return { kind: "ignore" };
  }

  return {
    kind: "result",
    transcript,
    isFinal: Boolean(payload.is_final)
  };
}

export function updateDeepgramTranscriptState(params: {
  finalTranscript: string;
  interimTranscript: string;
  result: { transcript: string; isFinal: boolean };
}): { finalTranscript: string; interimTranscript: string } {
  if (params.result.isFinal) {
    return {
      finalTranscript: appendTranscript(params.finalTranscript, params.result.transcript),
      interimTranscript: ""
    };
  }

  return {
    finalTranscript: params.finalTranscript,
    interimTranscript: params.result.transcript
  };
}

export function buildFinalDictationTranscript(finalTranscript: string, interimTranscript: string): string {
  return appendTranscript(finalTranscript, interimTranscript);
}

export function downsampleToMono16k(inputSamples: Float32Array, inputSampleRate: number): Int16Array {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    return new Int16Array(0);
  }

  const ratio = inputSampleRate / DEEPGRAM_TARGET_SAMPLE_RATE;
  if (ratio <= 0) {
    return new Int16Array(0);
  }

  const outputLength = Math.floor(inputSamples.length / ratio);
  const output = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(Math.floor((outputIndex + 1) * ratio), inputSamples.length);
    let sum = 0;
    let count = 0;

    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += inputSamples[sourceIndex] ?? 0;
      count += 1;
    }

    const average = count > 0 ? sum / count : inputSamples[start] ?? 0;
    const clamped = Math.max(-1, Math.min(1, average));
    output[outputIndex] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }

  return output;
}

export function int16ToArrayBuffer(samples: Int16Array): ArrayBuffer {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(index * 2, samples[index] ?? 0, true);
  }

  return bytes.buffer;
}
