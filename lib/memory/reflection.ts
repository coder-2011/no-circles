import { formatInTimeZone } from "date-fns-tz";
import { validateMemoryText } from "@/lib/memory/contract";
import {
  buildReflectionMemoryPrompt,
  REFLECTION_MEMORY_SYSTEM_PROMPT
} from "@/lib/ai/memory-prompts";
import {
  callAnthropicCompatibleTextModel,
  requireFirstEnv
} from "@/lib/ai/text-model-client";
import { logInfo, logWarn } from "@/lib/observability/log";
import { memoryReflectionOutputSchema } from "@/lib/schemas";
import type { DiscoveryBrief } from "@/lib/discovery/types";
import type { RecentEmailRecord } from "@/lib/memory/email-history";

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
  const modelName = requireFirstEnv(
    [
      "OPENROUTER_REFLECTION_MODEL",
      "OPENROUTER_MEMORY_MODEL",
      "ANTHROPIC_REFLECTION_MODEL",
      "ANTHROPIC_MEMORY_MODEL"
    ],
    "MISSING_ANTHROPIC_REFLECTION_OR_MEMORY_MODEL"
  );

  return callAnthropicCompatibleTextModel({
    model: modelName,
    systemPrompt: REFLECTION_MEMORY_SYSTEM_PROMPT,
    userPrompt: prompt,
    maxTokens: 1000,
    temperature: 0,
    missingApiKeyError: "MISSING_ANTHROPIC_API_KEY",
    invalidResponseError: "INVALID_REFLECTION_RESPONSE",
    emptyResponseError: "EMPTY_REFLECTION_RESPONSE",
    httpErrorPrefix: "ANTHROPIC_REFLECTION_HTTP_"
  });
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
