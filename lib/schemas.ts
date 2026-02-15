import { z } from "zod";

const timezoneSchema = z.string().refine((value) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Invalid timezone");

export const onboardingSchema = z.object({
  preferred_name: z.string().min(1).max(120),
  timezone: timezoneSchema,
  send_time_local: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "send_time_local must be HH:mm"),
  brain_dump_text: z.string().min(1).max(12000)
});

export const cronGenerateNextSchema = z.object({
  run_at_utc: z.string().datetime().optional()
});
