import { afterEach, describe, expect, it } from "vitest";
import {
  appendTranscript,
  buildWisprWebSocketUrl,
  downsampleToMono16k,
  encodePcm16WavBase64
} from "@/app/onboarding/wispr-dictation";

const originalWsBase = process.env.NEXT_PUBLIC_WISPR_WS_BASE;

describe("wispr-dictation helpers", () => {
  afterEach(() => {
    if (originalWsBase === undefined) {
      delete process.env.NEXT_PUBLIC_WISPR_WS_BASE;
      return;
    }

    process.env.NEXT_PUBLIC_WISPR_WS_BASE = originalWsBase;
  });

  it("builds websocket URL with encoded bearer token", () => {
    process.env.NEXT_PUBLIC_WISPR_WS_BASE = "wss://example.test/api/v1";
    const url = buildWisprWebSocketUrl("abc 123");
    expect(url).toBe("wss://example.test/api/v1/dash/client_ws?client_key=Bearer%20abc%20123");
  });

  it("appends transcript on a new line", () => {
    expect(appendTranscript("Current line", "Final transcript")).toBe("Current line\nFinal transcript");
    expect(appendTranscript("", "  Spoken text  ")).toBe("Spoken text");
    expect(appendTranscript("Current line", "   ")).toBe("Current line");
  });

  it("downsamples and encodes pcm wav payload", () => {
    const oneSecondAt48k = new Float32Array(48000);
    for (let index = 0; index < oneSecondAt48k.length; index += 1) {
      oneSecondAt48k[index] = Math.sin((2 * Math.PI * index) / 80);
    }

    const downsampled = downsampleToMono16k(oneSecondAt48k, 48000);
    expect(downsampled.length).toBe(16000);

    const base64 = encodePcm16WavBase64(downsampled);
    expect(base64.length).toBeGreaterThan(50);
  });
});
