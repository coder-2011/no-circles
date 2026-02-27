import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEnvString } from "@/lib/utils";

export const FEEDBACK_TOKEN_VERSION = 1;
const FEEDBACK_ROUTE_PATH = "/api/feedback/click";
const FEEDBACK_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 21;

export type FeedbackType = "more_like_this" | "less_like_this";

export type FeedbackClickTokenPayload = {
  v: number;
  uid: string;
  url: string;
  title: string;
  ft: FeedbackType;
  jti: string;
  exp: number;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadPart: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function isValidFeedbackType(value: unknown): value is FeedbackType {
  return value === "more_like_this" || value === "less_like_this";
}

export function buildFeedbackEventId(args: {
  userId: string;
  url: string;
  title: string;
  feedbackType: FeedbackType;
  expiresAtUnixSeconds: number;
}): string {
  const material = [args.userId, args.url, args.title, args.feedbackType, String(args.expiresAtUnixSeconds)].join("|");
  return createHash("sha256").update(material).digest("hex").slice(0, 40);
}

export function createFeedbackClickToken(args: {
  userId: string;
  url: string;
  title: string;
  feedbackType: FeedbackType;
  secret: string;
  expiresAtUnixSeconds?: number;
}): string {
  const exp =
    args.expiresAtUnixSeconds ?? Math.floor(Date.now() / 1000) + FEEDBACK_TOKEN_TTL_SECONDS;

  const payload: FeedbackClickTokenPayload = {
    v: FEEDBACK_TOKEN_VERSION,
    uid: args.userId,
    url: args.url,
    title: args.title.trim(),
    ft: args.feedbackType,
    jti: buildFeedbackEventId({
      userId: args.userId,
      url: args.url,
      title: args.title.trim(),
      feedbackType: args.feedbackType,
      expiresAtUnixSeconds: exp
    }),
    exp
  };

  const payloadPart = encodeBase64Url(JSON.stringify(payload));
  const signaturePart = signPayload(payloadPart, args.secret);
  return `${payloadPart}.${signaturePart}`;
}

export function verifyFeedbackClickToken(args: {
  token: string;
  secret: string;
  nowUnixSeconds?: number;
}):
  | { ok: true; payload: FeedbackClickTokenPayload }
  | { ok: false; reason: string } {
  const [payloadPart, signaturePart, ...rest] = args.token.split(".");
  if (!payloadPart || !signaturePart || rest.length > 0) {
    return { ok: false, reason: "INVALID_TOKEN_FORMAT" };
  }

  const expectedSignature = signPayload(payloadPart, args.secret);
  if (!safeCompare(signaturePart, expectedSignature)) {
    return { ok: false, reason: "INVALID_TOKEN_SIGNATURE" };
  }

  const parsed = (() => {
    try {
      return JSON.parse(decodeBase64Url(payloadPart)) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();

  if (!parsed) {
    return { ok: false, reason: "INVALID_TOKEN_PAYLOAD" };
  }

  const payload: FeedbackClickTokenPayload = {
    v: Number(parsed.v),
    uid: typeof parsed.uid === "string" ? parsed.uid : "",
    url: typeof parsed.url === "string" ? parsed.url : "",
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    ft: parsed.ft,
    jti: typeof parsed.jti === "string" ? parsed.jti : "",
    exp: Number(parsed.exp)
  } as FeedbackClickTokenPayload;

  if (
    payload.v !== FEEDBACK_TOKEN_VERSION ||
    !payload.uid ||
    !payload.url ||
    !payload.title ||
    !payload.jti ||
    !isValidFeedbackType(payload.ft) ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= 0
  ) {
    return { ok: false, reason: "INVALID_TOKEN_CLAIMS" };
  }

  const now = args.nowUnixSeconds ?? Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { ok: false, reason: "TOKEN_EXPIRED" };
  }

  const expectedJti = buildFeedbackEventId({
    userId: payload.uid,
    url: payload.url,
    title: payload.title,
    feedbackType: payload.ft,
    expiresAtUnixSeconds: payload.exp
  });

  if (payload.jti !== expectedJti) {
    return { ok: false, reason: "INVALID_TOKEN_JTI" };
  }

  return {
    ok: true,
    payload
  };
}

export function buildFeedbackClickUrl(args: { baseUrl: string; token: string }): string {
  const base = new URL(FEEDBACK_ROUTE_PATH, args.baseUrl);
  base.searchParams.set("token", args.token);
  return base.toString();
}

function isLocalhostHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizePublicOrigin(value: string | undefined): string | null {
  const candidate = normalizeEnvString(value);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate.startsWith("http://") || candidate.startsWith("https://") ? candidate : `https://${candidate}`);
    if (isLocalhostHost(parsed.hostname)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveFeedbackBaseUrl(): string | null {
  const configuredSite = normalizePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configuredSite) return configuredSite;

  return null;
}
