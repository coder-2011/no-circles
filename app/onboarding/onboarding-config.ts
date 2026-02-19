export type AuthState = "loading" | "signed_in" | "signed_out" | "error";
export type SubmitState = "idle" | "saving" | "saved" | "error";

export const BRAIN_DUMP_WORD_LIMIT = 500;
export const BRAIN_DUMP_DRAFT_KEY = "onboarding_brain_dump_draft_v1";

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
