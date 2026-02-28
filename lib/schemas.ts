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
  preferred_name: z.string().trim().min(1).max(120),
  timezone: timezoneSchema,
  send_time_local: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "send_time_local must be HH:mm"),
  brain_dump_text: z.string().min(1).max(12000)
});

export const cronGenerateNextSchema = z.object({
  run_at_utc: z.string().datetime().optional(),
  batch_size: z.number().int().min(1).max(25).optional()
});

export const resendInboundWebhookSchema = z.object({
  data: z.object({
    email_id: z.string().min(1).optional(),
    message_id: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    from: z.string().min(1),
    text: z.string().optional().default(""),
    headers: z.record(z.string(), z.string()).optional()
  })
});

const memoryTopicSchema = z.string().trim().min(1).max(120).transform((value) => value.toLowerCase());
const memoryLineSchema = z.string().trim().min(1).max(240);

export const memoryUpdateOpsSchema = z
  .object({
    add_active: z.array(memoryTopicSchema).max(20).default([]),
    add_active_core: z.array(memoryTopicSchema).max(20).default([]),
    add_active_side: z.array(memoryTopicSchema).max(20).default([]),
    remove_active: z.array(memoryTopicSchema).max(20).default([]),
    move_core_to_side: z.array(memoryTopicSchema).max(20).default([]),
    move_side_to_core: z.array(memoryTopicSchema).max(20).default([]),
    personality_add: z.array(memoryLineSchema).max(10).default([]),
    personality_remove: z.array(memoryLineSchema).max(10).default([]),
    recent_feedback_add: z.array(memoryLineSchema).max(8).default([])
  })
  .strict();

export const summaryWriterOutputSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    summary: z.string().trim().min(1).max(2000)
  })
  .strict();
