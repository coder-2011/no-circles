import { describe, expect, it } from "vitest";
import { onboardingSchema } from "@/lib/schemas";

describe("onboardingSchema", () => {
  const basePayload = {
    preferred_name: "Naman",
    timezone: "America/New_York",
    send_time_local: "09:30",
    brain_dump_text: "AI, coding, philosophy."
  };

  it("accepts a valid payload", () => {
    const parsed = onboardingSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);
  });

  it("accepts payload with optional extra email field", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, email: "not-trusted@example.com" });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid timezone", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, timezone: "Mars/Olympus_Mons" });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid send_time_local format", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, send_time_local: "25:99" });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-zero-padded send_time_local", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, send_time_local: "9:30" });
    expect(parsed.success).toBe(false);
  });

  it("accepts upper valid time boundary", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, send_time_local: "23:59" });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty brain_dump_text", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, brain_dump_text: "" });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty preferred_name", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, preferred_name: "" });
    expect(parsed.success).toBe(false);
  });

  it("trims preferred_name whitespace", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, preferred_name: "   Naman   " });
    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      return;
    }

    expect(parsed.data.preferred_name).toBe("Naman");
  });
});
