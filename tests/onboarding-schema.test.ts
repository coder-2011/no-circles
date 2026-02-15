import { describe, expect, it } from "vitest";
import { onboardingSchema } from "@/lib/schemas";

describe("onboardingSchema", () => {
  const basePayload = {
    email: "naman@example.com",
    preferred_name: "Naman",
    timezone: "America/New_York",
    send_time_local: "09:30",
    brain_dump_text: "AI, coding, philosophy."
  };

  it("accepts a valid payload", () => {
    const parsed = onboardingSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const parsed = onboardingSchema.safeParse({ ...basePayload, email: "not-an-email" });
    expect(parsed.success).toBe(false);
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
});
