import {
  MEMORY_HEADERS,
  MEMORY_WORD_CAP,
  enforceWordCap,
  parseSections,
  formatSections,
  validateMemoryText
} from "@/lib/memory/contract";
import { parseActiveInterestLanes } from "@/lib/memory/active-interest-lanes";
import { buildOnboardingMemoryPrompt, buildReplyMemoryPrompt } from "@/lib/ai/memory-prompts";
import { logInfo, logWarn } from "@/lib/observability/log";
import { memoryUpdateOpsSchema } from "@/lib/schemas";
import type { z } from "zod";

type GenerateMemoryArgs = {
  systemPrompt: string;
};

const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const MEMORY_MODEL_RETRIES = 2;
const MAX_RECENT_FEEDBACK_LINES = 8;
const ANTHROPIC_AUTH_ERROR = "ANTHROPIC_AUTH_FAILED";

function logMemoryEvent(level: "info" | "warn", event: string, details: Record<string, unknown>) {
  if (level === "warn") {
    logWarn("memory_processors", event, details);
    return;
  }

  logInfo("memory_processors", event, details);
}

function extractTextContent(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error("INVALID_MODEL_RESPONSE");
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
    throw new Error("EMPTY_MODEL_RESPONSE");
  }

  return text;
}

async function callMemoryModel(args: GenerateMemoryArgs): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const modelName = process.env.ANTHROPIC_MEMORY_MODEL?.trim();

  if (!apiKey) {
    throw new Error("MISSING_ANTHROPIC_API_KEY");
  }
  if (!modelName) {
    throw new Error("MISSING_ANTHROPIC_MEMORY_MODEL");
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
      max_tokens: 1200,
      temperature: 0,
      messages: [{ role: "user", content: args.systemPrompt }]
    })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(ANTHROPIC_AUTH_ERROR);
    }

    throw new Error(`ANTHROPIC_HTTP_${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!json) {
    throw new Error("INVALID_MODEL_RESPONSE");
  }

  return extractTextContent(json);
}

type MemorySections = Record<(typeof MEMORY_HEADERS)[number], string>;
type MemoryUpdateOps = z.infer<typeof memoryUpdateOpsSchema>;

function cleanLine(line: string): string {
  return line.replace(/^[-*\d.)\s]+/, "").trim();
}

function splitCompoundTopicLine(line: string): string[] {
  const cleaned = cleanLine(line);
  if (!cleaned || cleaned === "-") {
    return [];
  }

  const normalized = cleaned.replace(/\s{2,}/g, " ").trim();
  const dashSegments = normalized.split(/\s-\s/).map((segment) => segment.trim()).filter(Boolean);
  const primarySegments = dashSegments.length > 1 ? dashSegments : [normalized];
  const finalSegments = primarySegments
    .flatMap((segment) => segment.split(/\s*,\s*/))
    .map((segment) => segment.trim())
    .filter(Boolean);

  return finalSegments.length > 0 ? finalSegments : [normalized];
}

function uniqueLines(lines: Iterable<string>): string[] {
  const seen = new Map<string, string>();

  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, cleaned);
    }
  }

  return [...seen.values()];
}

function toBullets(lines: string[]): string {
  if (lines.length === 0) {
    return "-";
  }

  return lines.map((line) => `- ${line}`).join("\n");
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedMatch?.[1] ?? trimmed).trim();
  return JSON.parse(candidate);
}

function parseBulletLines(section: string): string[] {
  return uniqueLines(
    section
      .split("\n")
      .map((line) => cleanLine(line))
      .filter((line) => Boolean(line) && line !== "-")
  );
}

function parseTopicLines(section: string): string[] {
  return uniqueLines(
    section
      .split("\n")
      .flatMap((line) => splitCompoundTopicLine(line))
      .filter((line) => Boolean(line) && line !== "-")
  );
}

function expandTopicValues(values: Iterable<string>): string[] {
  return uniqueLines([...values].flatMap((value) => splitCompoundTopicLine(value)));
}

function formatActiveInterestBullets(core: string[], side: string[]): string {
  if (core.length === 0 && side.length === 0) {
    return "-";
  }

  const coreLines = core.map((topic) => `- ${topic}`);
  const sideLines = side.map((topic) => `- [side] ${topic}`);
  return [...coreLines, ...sideLines].join("\n");
}

function normalizeCanonicalMemoryTopics(memory: string): string {
  const sections = parseSections(memory);
  if (!sections) {
    return memory;
  }

  const activeLanes = parseActiveInterestLanes(sections.ACTIVE_INTERESTS);
  const activeCore = buildOrderedMap(activeLanes.core);
  const activeSide = buildOrderedMap(activeLanes.side);
  const suppressed = buildOrderedMap(parseTopicLines(sections.SUPPRESSED_INTERESTS));

  for (const key of activeCore.keys()) {
    activeSide.delete(key);
    suppressed.delete(key);
  }
  for (const key of activeSide.keys()) {
    suppressed.delete(key);
  }

  return buildFallbackMemory({
    PERSONALITY: sections.PERSONALITY,
    ACTIVE_INTERESTS: formatActiveInterestBullets([...activeCore.values()], [...activeSide.values()]),
    SUPPRESSED_INTERESTS: toBullets([...suppressed.values()]),
    RECENT_FEEDBACK: sections.RECENT_FEEDBACK
  });
}

function buildOrderedMap(values: Iterable<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const value of values) {
    const cleaned = cleanLine(value);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!map.has(key)) {
      map.set(key, cleaned);
    }
  }

  return map;
}

function removeMany(target: Map<string, string>, values: Iterable<string>) {
  for (const value of values) {
    target.delete(value.toLowerCase());
  }
}

function addMany(target: Map<string, string>, values: Iterable<string>) {
  for (const value of values) {
    const cleaned = cleanLine(value);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!target.has(key)) {
      target.set(key, cleaned);
    }
  }
}

function buildMemoryFromReplyOps(currentMemory: string, inboundReplyText: string, ops: MemoryUpdateOps): string {
  const sections = parseSections(currentMemory);
  const existingPersonality = sections ? parseBulletLines(sections.PERSONALITY) : [];
  const existingActiveLanes = sections ? parseActiveInterestLanes(sections.ACTIVE_INTERESTS) : { core: [], side: [] };
  const existingSuppressed = sections ? parseTopicLines(sections.SUPPRESSED_INTERESTS) : [];
  const existingFeedback = sections ? parseBulletLines(sections.RECENT_FEEDBACK) : [];

  const personality = buildOrderedMap(existingPersonality);
  const activeCore = buildOrderedMap(existingActiveLanes.core);
  const activeSide = buildOrderedMap(existingActiveLanes.side);
  const suppressed = buildOrderedMap(existingSuppressed);
  const feedback = buildOrderedMap(existingFeedback);

  removeMany(personality, ops.personality_remove);
  addMany(personality, ops.personality_add);

  const addActive = expandTopicValues(ops.add_active);
  const addActiveCore = expandTopicValues(ops.add_active_core);
  const addActiveSide = expandTopicValues(ops.add_active_side);
  const addSuppressed = expandTopicValues(ops.add_suppressed);
  const removeActive = expandTopicValues(ops.remove_active);
  const moveCoreToSide = expandTopicValues(ops.move_core_to_side);
  const moveSideToCore = expandTopicValues(ops.move_side_to_core);
  const removeSuppressed = expandTopicValues(ops.remove_suppressed);

  removeMany(activeCore, removeActive);
  removeMany(activeSide, removeActive);
  removeMany(suppressed, removeSuppressed);

  removeMany(activeCore, addSuppressed);
  removeMany(activeSide, addSuppressed);
  addMany(suppressed, addSuppressed);

  removeMany(activeCore, moveCoreToSide);
  addMany(activeSide, moveCoreToSide);

  removeMany(activeSide, moveSideToCore);
  addMany(activeCore, moveSideToCore);

  const mergedCoreAdds = uniqueLines([...addActive, ...addActiveCore]);
  removeMany(suppressed, mergedCoreAdds);
  removeMany(activeSide, mergedCoreAdds);
  addMany(activeCore, mergedCoreAdds);

  removeMany(suppressed, addActiveSide);
  removeMany(activeCore, addActiveSide);
  addMany(activeSide, addActiveSide);

  for (const key of activeCore.keys()) {
    activeSide.delete(key);
    suppressed.delete(key);
  }
  for (const key of activeSide.keys()) {
    suppressed.delete(key);
  }

  const feedbackLines = ops.recent_feedback_add.length > 0 ? ops.recent_feedback_add : [inboundReplyText];
  addMany(feedback, feedbackLines);

  const condensedFeedback = [...feedback.values()].slice(-MAX_RECENT_FEEDBACK_LINES);

  return buildFallbackMemory({
    PERSONALITY: toBullets([...personality.values()]),
    ACTIVE_INTERESTS: formatActiveInterestBullets([...activeCore.values()], [...activeSide.values()]),
    SUPPRESSED_INTERESTS: toBullets([...suppressed.values()]),
    RECENT_FEEDBACK: toBullets(condensedFeedback)
  });
}

function extractUniqueSegments(
  text: string,
  splitter: RegExp,
  include: (segment: string) => boolean = () => true
): string[] {
  const segments: string[] = [];
  for (const segment of text.split(splitter)) {
    const trimmed = segment.trim();
    if (!trimmed || !include(trimmed)) {
      continue;
    }
    segments.push(trimmed);
  }

  return uniqueLines(segments);
}

function extractInterestSignals(text: string): string[] {
  return extractUniqueSegments(text, /[\n,]/);
}

function buildFallbackMemory(sections: MemorySections): string {
  return enforceWordCap(formatSections(sections), MEMORY_WORD_CAP);
}

export function buildFallbackOnboardingMemory(brainDumpText: string): string {
  const interests = extractInterestSignals(brainDumpText).slice(0, 24);

  return buildFallbackMemory({
    PERSONALITY: toBullets(interests.slice(0, 6).length > 0 ? interests.slice(0, 6) : ["Curious learner"]),
    ACTIVE_INTERESTS: toBullets(interests.length > 0 ? interests : ["General curiosity"]),
    SUPPRESSED_INTERESTS: "-",
    RECENT_FEEDBACK: "- Initialized from onboarding brain dump"
  });
}

export function buildFallbackReplyMemory(currentMemory: string, inboundReplyText: string): string {
  const addedInterests = extractInterestSignals(inboundReplyText).slice(0, 12);
  const sections = parseSections(currentMemory);

  return buildFallbackMemory({
    PERSONALITY: sections?.PERSONALITY || "- Evolving learner profile",
    ACTIVE_INTERESTS: toBullets(
      addedInterests.length > 0 ? addedInterests : ["No new explicit additions from latest reply"]
    ),
    SUPPRESSED_INTERESTS: sections?.SUPPRESSED_INTERESTS || "-",
    RECENT_FEEDBACK: toBullets([inboundReplyText])
  });
}

async function generateWithFallback(prompt: string, fallbackMemory: string): Promise<string> {
  for (let attempt = 0; attempt < MEMORY_MODEL_RETRIES; attempt += 1) {
    try {
      const generated = await callMemoryModel({ systemPrompt: prompt });
      const validated = validateMemoryText(generated);

      if (validated.ok) {
        logMemoryEvent("info", "onboarding_model_success", { attempt: attempt + 1 });
        return validated.memoryText;
      }

      logMemoryEvent("warn", "onboarding_model_invalid_output", {
        attempt: attempt + 1,
        reason: validated.reason
      });
    } catch (error) {
      logMemoryEvent("warn", "onboarding_model_error", {
        attempt: attempt + 1,
        reason: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      });

      if (error instanceof Error && error.message === ANTHROPIC_AUTH_ERROR) {
        throw error;
      }
    }
  }

  logMemoryEvent("warn", "onboarding_fallback_used", {
    reason: "model_unavailable_or_invalid_output"
  });
  return fallbackMemory;
}

async function generateOnboardingMemoryRequired(prompt: string, fallbackMemory: string): Promise<string> {
  const generated = await generateWithFallback(prompt, fallbackMemory);
  if (generated === fallbackMemory) {
    throw new Error("ONBOARDING_MODEL_REQUIRED");
  }

  return generated;
}

async function generateReplyMemoryWithFallback(
  currentMemory: string,
  inboundReplyText: string,
  prompt: string,
  fallbackMemory: string
): Promise<string> {
  for (let attempt = 0; attempt < MEMORY_MODEL_RETRIES; attempt += 1) {
    try {
      const generated = await callMemoryModel({ systemPrompt: prompt });
      const parsedJson = parseJsonFromModelText(generated);
      const parsedOps = memoryUpdateOpsSchema.safeParse(parsedJson);

      if (!parsedOps.success) {
        logMemoryEvent("warn", "reply_model_schema_invalid", {
          attempt: attempt + 1,
          issue_count: parsedOps.error.issues.length
        });
        continue;
      }

      const merged = buildMemoryFromReplyOps(currentMemory, inboundReplyText, parsedOps.data);
      const validated = validateMemoryText(merged);

      if (validated.ok) {
        logMemoryEvent("info", "reply_model_success", { attempt: attempt + 1 });
        return validated.memoryText;
      }

      logMemoryEvent("warn", "reply_model_merge_invalid", {
        attempt: attempt + 1,
        reason: validated.reason
      });
    } catch (error) {
      logMemoryEvent("warn", "reply_model_error", {
        attempt: attempt + 1,
        reason: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      });

      if (error instanceof Error && error.message === ANTHROPIC_AUTH_ERROR) {
        break;
      }
    }
  }

  logMemoryEvent("warn", "reply_fallback_used", {
    reason: "model_unavailable_or_invalid_output"
  });
  return fallbackMemory;
}

export async function formatOnboardingMemory(brainDumpText: string): Promise<string> {
  const fallbackMemory = buildFallbackOnboardingMemory(brainDumpText);
  const prompt = buildOnboardingMemoryPrompt(brainDumpText);
  const generated = await generateOnboardingMemoryRequired(prompt, fallbackMemory);
  return normalizeCanonicalMemoryTopics(generated);
}

export async function mergeReplyIntoMemory(
  currentInterestMemoryText: string,
  inboundReplyText: string
): Promise<string> {
  const fallbackMemory = buildFallbackReplyMemory(currentInterestMemoryText, inboundReplyText);
  const prompt = buildReplyMemoryPrompt(currentInterestMemoryText, inboundReplyText);
  const merged = await generateReplyMemoryWithFallback(currentInterestMemoryText, inboundReplyText, prompt, fallbackMemory);
  return normalizeCanonicalMemoryTopics(merged);
}
