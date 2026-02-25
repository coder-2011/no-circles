export type AuthState = "loading" | "signed_in" | "signed_out" | "error";
export type SubmitState = "idle" | "saving" | "saved" | "error";
export type DictationState = "idle" | "warming" | "recording" | "stopping";

export const BRAIN_DUMP_WORD_LIMIT = 1000;
export const BRAIN_DUMP_DRAFT_KEY = "onboarding_brain_dump_draft_v1";
export const ONBOARDING_PREFS_DRAFT_KEY = "onboarding_prefs_draft_v1";
export const ONBOARDING_REAUTH_RECOVERY_KEY = "onboarding_reauth_recovery_v1";
export const ONBOARDING_QUICK_SPARKS_URL = "/onboarding-quick-sparks.txt";
export const ONBOARDING_QUICK_SPARKS_DECK_KEY = "onboarding_quick_sparks_deck_v1";
export const ONBOARDING_QUICK_SPARKS_VISIBLE_COUNT = 7;
export const ONBOARDING_QUICK_SPARKS_DRAWER_COUNT = 21;
export const ONBOARDING_QUICK_SPARKS_SCROLL_LOAD_COUNT = 12;
export const DEEPGRAM_TOKEN_FALLBACK_TTL_SECONDS = 30;
export const DEEPGRAM_TOKEN_REUSE_SAFETY_WINDOW_MS = 10_000;
export const DICTATION_WARMUP_COOLDOWN_MS = 12_000;

export const CURATED_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata"
] as const;

export const INTEREST_QUICK_SPARKS = [
  "AI research breakthroughs",
  "Systems design and engineering strategy",
  "Philosophy that changes decisions",
  "History with modern parallels",
  "Deep dives on scientific discoveries",
  "Great books and long-form writing",
  "Economics through first principles"
] as const;

export function shuffleQuickSparks(items: string[]): string[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j] ?? next[i];
    next[j] = tmp;
  }
  return next;
}

export function resolveDeepgramTokenExpiryAtMs(args: {
  nowMs: number;
  expiresInSeconds: number | null | undefined;
  fallbackTtlSeconds?: number;
}): number {
  const fallbackTtlSeconds = Math.max(1, Math.floor(args.fallbackTtlSeconds ?? DEEPGRAM_TOKEN_FALLBACK_TTL_SECONDS));
  const ttlSeconds =
    typeof args.expiresInSeconds === "number" && Number.isFinite(args.expiresInSeconds)
      ? Math.max(1, Math.floor(args.expiresInSeconds))
      : fallbackTtlSeconds;

  return args.nowMs + ttlSeconds * 1000;
}

export function isDeepgramTokenUsable(args: {
  nowMs: number;
  expiresAtMs: number | null;
  safetyWindowMs?: number;
}): boolean {
  if (typeof args.expiresAtMs !== "number" || !Number.isFinite(args.expiresAtMs)) {
    return false;
  }

  const safetyWindowMs = Math.max(0, args.safetyWindowMs ?? DEEPGRAM_TOKEN_REUSE_SAFETY_WINDOW_MS);
  return args.expiresAtMs - args.nowMs > safetyWindowMs;
}

export function shouldWarmupDictation(args: {
  dictationState: DictationState;
  nowMs: number;
  lastWarmupAtMs: number;
  tokenExpiresAtMs: number | null;
  tokenRequestInFlight: boolean;
  moduleRequestInFlight: boolean;
  cooldownMs?: number;
  tokenSafetyWindowMs?: number;
}): boolean {
  if (args.dictationState !== "idle") {
    return false;
  }

  if (args.tokenRequestInFlight || args.moduleRequestInFlight) {
    return false;
  }

  const cooldownMs = Math.max(0, args.cooldownMs ?? DICTATION_WARMUP_COOLDOWN_MS);
  if (args.nowMs - args.lastWarmupAtMs < cooldownMs) {
    return false;
  }

  if (
    isDeepgramTokenUsable({
      nowMs: args.nowMs,
      expiresAtMs: args.tokenExpiresAtMs,
      safetyWindowMs: args.tokenSafetyWindowMs
    })
  ) {
    return false;
  }

  return true;
}

export const PREFERRED_NAME_SUGGESTIONS = [
  "Alan Turing",
  "Fyodor Dostoevsky",
  "Nikola Tesla",
  "Ada Lovelace",
  "Marie Curie",
  "Srinivasa Ramanujan",
  "Hannah Arendt",
  "Carl Sagan"
] as const;

const EMAIL_LOCAL_PART_FIRST_LAST_PATTERN = /^([a-zA-Z]{2,})[._-]([a-zA-Z]{2,})$/;

export function toDisplayNameToken(token: string): string {
  if (!token) {
    return "";
  }

  return token[0].toUpperCase() + token.slice(1).toLowerCase();
}

export function getPreferredNameFromEmail(email: string | null): string | null {
  if (!email) {
    return null;
  }

  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return null;
  }

  const localPart = email.slice(0, atIndex).trim();
  const match = EMAIL_LOCAL_PART_FIRST_LAST_PATTERN.exec(localPart);
  if (!match) {
    return null;
  }

  const firstName = toDisplayNameToken(match[1] ?? "");
  const lastName = toDisplayNameToken(match[2] ?? "");
  if (!firstName || !lastName) {
    return null;
  }

  return `${firstName} ${lastName}`;
}

function sanitizePreferredName(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 120);
}

export function getPreferredNameFromOAuthProfile(userMetadata: unknown): string | null {
  if (!userMetadata || typeof userMetadata !== "object") {
    return null;
  }

  const metadata = userMetadata as Record<string, unknown>;
  const fullName = typeof metadata.full_name === "string" ? sanitizePreferredName(metadata.full_name) : null;
  if (fullName) {
    return fullName;
  }

  const name = typeof metadata.name === "string" ? sanitizePreferredName(metadata.name) : null;
  if (name) {
    return name;
  }

  const givenName = typeof metadata.given_name === "string" ? sanitizePreferredName(metadata.given_name) : null;
  if (givenName) {
    return givenName;
  }

  return null;
}

export function getDetectedTimezone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected?.trim() || "America/New_York";
}

export function buildTimezoneOptions(selectedTimezone: string): string[] {
  if (!selectedTimezone) {
    return [...CURATED_TIMEZONES];
  }

  if (CURATED_TIMEZONES.includes(selectedTimezone as (typeof CURATED_TIMEZONES)[number])) {
    return [...CURATED_TIMEZONES];
  }

  return [selectedTimezone, ...CURATED_TIMEZONES];
}

export function initialSendTimeFromLocalNow(): string {
  return "08:00";
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function truncateToWordLimit(text: string, wordLimit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordLimit) {
    return text;
  }

  return words.slice(0, wordLimit).join(" ");
}

export function parseSendTime(sendTime: string): {
  hour12: string;
  minute: string;
  meridiem: "AM" | "PM";
} {
  const [hourToken, minuteToken] = sendTime.split(":");
  const hour = Number.parseInt(hourToken ?? "8", 10);
  const minute = Number.parseInt(minuteToken ?? "0", 10);

  const safeHour24 = Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 8;
  const safeMinute = Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0;
  const meridiem: "AM" | "PM" = safeHour24 >= 12 ? "PM" : "AM";
  const hour12Raw = safeHour24 % 12;
  const hour12 = hour12Raw === 0 ? 12 : hour12Raw;

  return { hour12: String(hour12), minute: String(safeMinute).padStart(2, "0"), meridiem };
}

export function buildSendTime(hour12: string, minute: string, meridiem: "AM" | "PM"): string {
  const parsedHour12 = Number.parseInt(hour12, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  const normalizedHour12 = Number.isFinite(parsedHour12) ? Math.max(1, Math.min(12, parsedHour12)) : 8;
  const normalizedMinute = Number.isFinite(parsedMinute) ? Math.max(0, Math.min(59, parsedMinute)) : 0;

  let hour24 = normalizedHour12 % 12;
  if (meridiem === "PM") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`;
}
