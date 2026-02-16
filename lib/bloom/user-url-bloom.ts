import { createHash } from "node:crypto";

const DEFAULT_BLOOM_M = 65536;
const DEFAULT_BLOOM_K = 7;
const DEFAULT_FP_THRESHOLD = 0.02;
const MIN_BLOOM_M = 1024;
const MAX_BLOOM_M = 1_048_576;
const MIN_BLOOM_K = 1;
const MAX_BLOOM_K = 16;

export type UserBloomState = {
  bits: Buffer;
  m: number;
  k: number;
  count: number;
};

type BloomUserRow = {
  sentUrlBloomBits?: string | null;
};

function requiredByteLength(m: number): number {
  return Math.ceil(m / 8);
}

function maxBase64LengthForByteLength(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

function decodeBits(base64Bits: string | null | undefined, m: number): Buffer {
  const byteLength = requiredByteLength(m);
  if (!base64Bits) {
    return Buffer.alloc(byteLength);
  }

  // Prevent oversized payloads from causing large decode allocations.
  if (base64Bits.length > maxBase64LengthForByteLength(byteLength)) {
    return Buffer.alloc(byteLength);
  }

  try {
    const decoded = Buffer.from(base64Bits, "base64");
    if (decoded.length === byteLength) {
      return decoded;
    }

    if (decoded.length > byteLength) {
      return decoded.subarray(0, byteLength);
    }

    const padded = Buffer.alloc(byteLength);
    decoded.copy(padded);
    return padded;
  } catch {
    return Buffer.alloc(byteLength);
  }
}

function toBoundedInt(
  value: number | null | undefined,
  fallback: number,
  bounds: { min: number; max: number }
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  if (normalized < bounds.min || normalized > bounds.max) {
    return fallback;
  }

  return normalized;
}

function hash64(seed: string): bigint {
  const hash = createHash("sha256").update(seed).digest();
  return hash.readBigUInt64BE(0);
}

export function canonicalUrlHashIndices(canonicalUrl: string, m: number, k: number): number[] {
  const normalized = canonicalUrl.trim();
  if (!normalized) {
    return [];
  }

  const bigM = BigInt(m);
  const h1 = hash64(`url:${normalized}`);
  const h2 = hash64(`salt:${normalized}`) | 1n;

  const indices: number[] = [];
  for (let i = 0; i < k; i += 1) {
    const index = Number((h1 + BigInt(i) * h2) % bigM);
    indices.push(index);
  }

  return indices;
}

function readBit(bits: Buffer, index: number): boolean {
  const byteIndex = Math.floor(index / 8);
  const bitMask = 1 << (index % 8);
  return (bits[byteIndex] & bitMask) !== 0;
}

function writeBit(bits: Buffer, index: number): void {
  const byteIndex = Math.floor(index / 8);
  const bitMask = 1 << (index % 8);
  bits[byteIndex] |= bitMask;
}

export function normalizeBloomStateFromUserRow(row: BloomUserRow): UserBloomState {
  const m = toBoundedInt(DEFAULT_BLOOM_M, DEFAULT_BLOOM_M, { min: MIN_BLOOM_M, max: MAX_BLOOM_M });
  const k = toBoundedInt(DEFAULT_BLOOM_K, DEFAULT_BLOOM_K, { min: MIN_BLOOM_K, max: MAX_BLOOM_K });
  const bits = decodeBits(row.sentUrlBloomBits, m);
  const count = estimateCardinalityFromBits({ bits, m, k });

  return {
    bits,
    m,
    k,
    count
  };
}

export function mightContainCanonicalUrl(state: UserBloomState, canonicalUrl: string): boolean {
  const indices = canonicalUrlHashIndices(canonicalUrl, state.m, state.k);
  if (indices.length === 0) {
    return false;
  }

  for (const index of indices) {
    if (!readBit(state.bits, index)) {
      return false;
    }
  }

  return true;
}

export function addCanonicalUrls(state: UserBloomState, canonicalUrls: string[]): UserBloomState {
  const nextState: UserBloomState = {
    ...state,
    bits: Buffer.from(state.bits)
  };

  const uniqueUrls = [...new Set(canonicalUrls.map((url) => url.trim()).filter(Boolean))];

  for (const canonicalUrl of uniqueUrls) {
    const indices = canonicalUrlHashIndices(canonicalUrl, nextState.m, nextState.k);
    for (const index of indices) {
      writeBit(nextState.bits, index);
    }
  }

  nextState.count = estimateCardinalityFromBits(nextState);
  return nextState;
}

function countSetBits(bits: Buffer): number {
  let count = 0;
  for (let i = 0; i < bits.length; i += 1) {
    let value = bits[i];
    while (value > 0) {
      value &= value - 1;
      count += 1;
    }
  }
  return count;
}

function estimateCardinalityFromBits(state: Pick<UserBloomState, "bits" | "m" | "k">): number {
  if (state.m <= 0 || state.k <= 0) {
    return 0;
  }

  const setBits = countSetBits(state.bits);
  const fillRatio = Math.min(1, setBits / state.m);
  if (fillRatio <= 0) {
    return 0;
  }

  if (fillRatio >= 1) {
    return Number.MAX_SAFE_INTEGER;
  }

  const estimate = -((state.m / state.k) * Math.log(1 - fillRatio));
  if (!Number.isFinite(estimate) || estimate < 0) {
    return 0;
  }

  return Math.round(estimate);
}

export function estimateFalsePositiveRate(state: Pick<UserBloomState, "m" | "k" | "count">): number {
  if (state.m <= 0 || state.k <= 0 || state.count <= 0) {
    return 0;
  }

  const exponent = (-state.k * state.count) / state.m;
  return Math.pow(1 - Math.exp(exponent), state.k);
}

export function maybeRotate(
  state: UserBloomState,
  args: { threshold?: number } = {}
): { state: UserBloomState; rotated: boolean; estimatedFalsePositiveRate: number } {
  const threshold = args.threshold ?? DEFAULT_FP_THRESHOLD;
  const estimatedFalsePositiveRate = estimateFalsePositiveRate(state);

  if (estimatedFalsePositiveRate <= threshold) {
    return { state, rotated: false, estimatedFalsePositiveRate };
  }

  return {
    state: {
      ...state,
      bits: Buffer.alloc(requiredByteLength(state.m)),
      count: 0
    },
    rotated: true,
    estimatedFalsePositiveRate
  };
}

export function encodeBloomBitsBase64(state: UserBloomState): string {
  return state.bits.toString("base64");
}
