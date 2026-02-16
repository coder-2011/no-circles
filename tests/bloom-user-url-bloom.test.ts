import { describe, expect, it } from "vitest";
import {
  addCanonicalUrls,
  canonicalUrlHashIndices,
  encodeBloomBitsBase64,
  estimateFalsePositiveRate,
  maybeRotate,
  mightContainCanonicalUrl,
  normalizeBloomStateFromUserRow
} from "@/lib/bloom/user-url-bloom";

describe("user-url-bloom", () => {
  it("produces deterministic indices for canonical URLs", () => {
    const a = canonicalUrlHashIndices("https://example.com/a", 65536, 7);
    const b = canonicalUrlHashIndices("https://example.com/a", 65536, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(7);
    expect(a.every((value) => value >= 0 && value < 65536)).toBe(true);
  });

  it("is false before add and true after add", () => {
    const state = normalizeBloomStateFromUserRow({
      sentUrlBloomBits: null
    });

    const url = "https://example.com/article";
    expect(mightContainCanonicalUrl(state, url)).toBe(false);

    const next = addCanonicalUrls(state, [url]);
    expect(mightContainCanonicalUrl(next, url)).toBe(true);
    expect(next.count).toBe(1);
  });

  it("updates bits deterministically when adding multiple urls", () => {
    const base = normalizeBloomStateFromUserRow({
      sentUrlBloomBits: null
    });

    const urls = ["https://example.com/a", "https://example.com/b", "https://example.com/c"];

    const nextA = addCanonicalUrls(base, urls);
    const nextB = addCanonicalUrls(base, urls);

    expect(nextA.bits.equals(nextB.bits)).toBe(true);
    expect(nextA.count).toBe(3);
  });

  it("computes monotonic false-positive estimate as count grows", () => {
    const low = estimateFalsePositiveRate({ m: 65536, k: 7, count: 100 });
    const high = estimateFalsePositiveRate({ m: 65536, k: 7, count: 10000 });

    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeGreaterThan(low);
  });

  it("rotates when estimated false-positive rate is above threshold", () => {
    const state = normalizeBloomStateFromUserRow({
      sentUrlBloomBits: Buffer.alloc(8192, 255).toString("base64")
    });

    const result = maybeRotate(state, { threshold: 0.02 });

    expect(result.rotated).toBe(true);
    expect(result.state.count).toBe(0);
    expect(result.state.bits.every((value) => value === 0)).toBe(true);
  });

  it("normalizes oversized persisted base64 bitsets to an empty bounded buffer", () => {
    const oversized = "A".repeat(20000);
    const state = normalizeBloomStateFromUserRow({
      sentUrlBloomBits: oversized
    });

    expect(state.bits).toHaveLength(8192);
    expect(state.bits.every((value) => value === 0)).toBe(true);
    expect(state.count).toBe(0);
  });

  it("keeps estimated count monotonic under collision-heavy saturation", () => {
    let state = normalizeBloomStateFromUserRow({ sentUrlBloomBits: null });
    const counts: number[] = [state.count];

    for (let batch = 0; batch < 20; batch += 1) {
      const urls = Array.from({ length: 500 }).map((_, index) => `https://collision-heavy.example/${batch}-${index}`);
      state = addCanonicalUrls(state, urls);
      counts.push(state.count);
    }

    const restored = normalizeBloomStateFromUserRow({ sentUrlBloomBits: encodeBloomBitsBase64(state) });
    counts.push(restored.count);

    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });
});
