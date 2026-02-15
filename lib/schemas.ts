import { z } from "zod";

export const onboardingSchema = z.object({
  preferred_name: z.string().min(1).max(120),
  timezone: z.string().min(1),
  send_time_local: z.string().regex(/^\d{2}:\d{2}$/),
  brain_dump_text: z.string().min(1).max(12000)
});

export const cronGenerateNextSchema = z.object({
  run_at_utc: z.string().datetime().optional()
});
