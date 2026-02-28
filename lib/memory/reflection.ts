import { formatInTimeZone } from "date-fns-tz";
import { validateMemoryText } from "@/lib/memory/contract";
import {
  buildReflectionMemoryPrompt,
  REFLECTION_MEMORY_SYSTEM_PROMPT
} from "@/lib/ai/memory-prompts";
import { logInfo, logWarn } from "@/lib/observability/log";
import { memoryReflectionOutputSchema } from "@/lib/schemas";
import type { DiscoveryBrief } from "@/lib/discovery/types";
import type { RecentEmailRecord } from "@/lib/memory/email-history";

const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const EMPTY_DISCOVERY_BRIEF: DiscoveryBrief = {
  reinforceTopics: [],
  avoidPatterns: [],
  preferredAngles: [],
  noveltyMoves: []
};

function logReflectionEvent(level: "info" | "warn", event: string, details: Record<string, unknown>) {
  if (level === "warn") {
    logWarn("memory_reflection", event, details);
    return;
  }

  logInfo("memory_reflection", event, details);
}

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_REFLECTION_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_REFLECTION_RESPONSE");
  }

  const text = content
    .filter((chunk): chunk is { type: string; text: string } => {
      if (!chunk || typeof chunk !== "object") {
        return false;
      }

      const candidate = chunk as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string";
    })
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("EMPTY_REFLECTION_RESPONSE");
  }

  return text;
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? trimmed).trim();
  return JSON.parse(candidate);
}

function localDayNumber(date: Date, timezone: string): number {
  const localDate = formatInTimeZone(date, timezone, "yyyy-MM-dd");
  return Math.trunc(Date.parse(`${localDate}T00:00:00Z`) / 86_400_000);
}

export function shouldRunBiDailyReflection(args: {
  issueVariant: "daily" | "welcome";
  timezone: string;
  runAtUtc: Date;
  lastReflectionAt: Date | null;
}): boolean {
  if (args.issueVariant !== "daily") {
    return false;
  }

  if (!args.lastReflectionAt) {
    return true;
  }

  return localDayNumber(args.runAtUtc, args.timezone) - localDayNumber(args.lastReflectionAt, args.timezone) >= 2;
}

async function callReflectionModel(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName = process.env.ANTHROPIC_REFLECTION_MODEL?.trim() || process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  if (!apiKey) {
    throw new Error("MISSING_ANTHROPIC_API_KEY");
  }

  if (!modelName) {
    throw new Error("MISSING_ANTHROPIC_REFLECTION_OR_MEMORY_MODEL");
  }

  const response = await fetch(ANTHROPIC_MESSAGES_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 1000,
      temperature: 0,
      system: REFLECTION_MEMORY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`ANTHROPIC_REFLECTION_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!json) {
    throw new Error("INVALID_REFLECTION_RESPONSE");
  }

  return extractTextContent(json);
}

export async function runBiDailyReflection(args: {
  userId: string;
  timezone: string;
  runAtUtc: Date;
  currentMemoryText: string;
  recentSentEmails: RecentEmailRecord[];
  recentReplyEmails: RecentEmailRecord[];
}): Promise<{
  reviewedAt: Date;
  decision: "no_change" | "rewrite";
  memoryText: string;
  discoveryBrief: DiscoveryBrief;
}> {
  if (args.recentSentEmails.length === 0 && args.recentReplyEmails.length === 0) {
    logReflectionEvent("info", "reflection_skipped_no_recent_email_history", {
      user_id: args.userId,
      run_at_utc: args.runAtUtc.toISOString()
    });

    return {
      reviewedAt: args.runAtUtc,
      decision: "no_change",
      memoryText: args.currentMemoryText,
      discoveryBrief: EMPTY_DISCOVERY_BRIEF
    };
  }

  const prompt = buildReflectionMemoryPrompt({
    referenceDateLocal: formatInTimeZone(args.runAtUtc, args.timezone, "yyyy-MM-dd"),
    currentMemory: args.currentMemoryText,
    recentSentEmails: args.recentSentEmails,
    recentReplyEmails: args.recentReplyEmails
  });

  try {
    const modelText = await callReflectionModel(prompt);
    const parsedJson = parseJsonFromModelText(modelText);
    const parsed = memoryReflectionOutputSchema.safeParse(parsedJson);

    if (!parsed.success) {
      logReflectionEvent("warn", "reflection_schema_invalid", {
        user_id: args.userId,
        issue_count: parsed.error.issues.length
      });

      return {
        reviewedAt: args.runAtUtc,
        decision: "no_change",
        memoryText: args.currentMemoryText,
        discoveryBrief: EMPTY_DISCOVERY_BRIEF
      };
    }

    if (parsed.data.decision === "no_change") {
      logReflectionEvent("info", "reflection_noop", {
        user_id: args.userId,
        run_at_utc: args.runAtUtc.toISOString()
      });

      return {
        reviewedAt: args.runAtUtc,
        decision: "no_change",
        memoryText: args.currentMemoryText,
        discoveryBrief: parsed.data.discoveryBrief
      };
    }

    const validated = validateMemoryText(parsed.data.memoryText);
    if (!validated.ok) {
      logReflectionEvent("warn", "reflection_invalid_memory", {
        user_id: args.userId,
        run_at_utc: args.runAtUtc.toISOString(),
        reason: validated.reason
      });

      return {
        reviewedAt: args.runAtUtc,
        decision: "no_change",
        memoryText: args.currentMemoryText,
        discoveryBrief: parsed.data.discoveryBrief
      };
    }

    const changed = validated.memoryText.trim() !== args.currentMemoryText.trim();
    logReflectionEvent("info", changed ? "reflection_applied" : "reflection_effectively_unchanged", {
      user_id: args.userId,
      run_at_utc: args.runAtUtc.toISOString()
    });

    return {
      reviewedAt: args.runAtUtc,
      decision: changed ? "rewrite" : "no_change",
      memoryText: changed ? validated.memoryText : args.currentMemoryText,
      discoveryBrief: parsed.data.discoveryBrief
    };
  } catch (error) {
    logReflectionEvent("warn", "reflection_failed", {
      user_id: args.userId,
      run_at_utc: args.runAtUtc.toISOString(),
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
    });

    return {
      reviewedAt: args.runAtUtc,
      decision: "no_change",
      memoryText: args.currentMemoryText,
      discoveryBrief: EMPTY_DISCOVERY_BRIEF
    };
  }
}
