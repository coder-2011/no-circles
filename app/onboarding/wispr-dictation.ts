const DEFAULT_WISPR_HTTP_BASE = "https://platform-api.wisprflow.ai/api/v1";
const DEFAULT_WISPR_WS_BASE = "wss://platform-api.wisprflow.ai/api/v1";
const WISPR_TARGET_SAMPLE_RATE = 16000;

export function getWisprClientKey(): string | null {
  const key = process.env.NEXT_PUBLIC_WISPR_CLIENT_KEY?.trim();
  return key ? key : null;
}

export function getWisprAccessToken(): string | null {
  const token = process.env.NEXT_PUBLIC_WISPR_ACCESS_TOKEN?.trim();
  return token ? token : null;
}

export function buildWisprWarmupUrl(): string {
  const base = process.env.NEXT_PUBLIC_WISPR_HTTP_BASE?.trim() || DEFAULT_WISPR_HTTP_BASE;
  return `${base.replace(/\/$/, "")}/warmup_dash`;
}

export function buildWisprWebSocketUrl(clientKey: string): string {
  const base = process.env.NEXT_PUBLIC_WISPR_WS_BASE?.trim() || DEFAULT_WISPR_WS_BASE;
  const encodedClientKey = encodeURIComponent(`Bearer ${clientKey}`);
  return `${base.replace(/\/$/, "")}/dash/client_ws?client_key=${encodedClientKey}`;
}

export function appendTranscript(currentText: string, transcript: string): string {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) {
    return currentText;
  }

  const normalizedCurrent = currentText.trimEnd();
  return normalizedCurrent ? `${normalizedCurrent}\n${cleanTranscript}` : cleanTranscript;
}

export function downsampleToMono16k(inputSamples: Float32Array, inputSampleRate: number): Int16Array {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    return new Int16Array(0);
  }

  const ratio = inputSampleRate / WISPR_TARGET_SAMPLE_RATE;
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

export function encodePcm16WavBase64(samples: Int16Array, sampleRate = WISPR_TARGET_SAMPLE_RATE): string {
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + samples.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(headerSize + index * 2, samples[index] ?? 0, true);
  }

  return bytesToBase64(new Uint8Array(buffer));
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const maybeBuffer = (globalThis as { Buffer?: { from: (value: Uint8Array) => { toString: (enc: string) => string } } })
    .Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }

  return btoa(binary);
}
