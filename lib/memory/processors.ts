import {
  MEMORY_HEADERS,
  MEMORY_WORD_CAP,
  enforceWordCap,
  parseSections,
  formatSections,
  validateMemoryText
} from "@/lib/memory/contract";
import { parseActiveInterestLanes } from "@/lib/memory/active-interest-lanes";
import {
  buildOnboardingMemoryPrompt,
  buildReplyMemoryPrompt,
  ONBOARDING_MEMORY_SYSTEM_PROMPT,
  REPLY_MEMORY_SYSTEM_PROMPT
} from "@/lib/ai/memory-prompts";
import {
  ANTHROPIC_AUTH_ERROR,
  callMemoryModel
} from "@/lib/memory/model-client";
import { logInfo, logWarn } from "@/lib/observability/log";
import { memoryUpdateOpsSchema } from "@/lib/schemas";
import type { z } from "zod";
const MEMORY_MODEL_RETRIES = 2;
const MAX_RECENT_FEEDBACK_LINES = 10;

function logMemoryEvent(level: "info" | "warn", event: string, details: Record<string, unknown>) {
  if (level === "warn") {
    logWarn("memory_processors", event, details);
    return;
  }

  logInfo("memory_processors", event, details);
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

function parseBulletLinesPreserveOrder(section: string): string[] {
  return section
    .split("\n")
    .map((line) => cleanLine(line))
    .filter((line) => Boolean(line) && line !== "-");
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

  for (const key of activeCore.keys()) {
    activeSide.delete(key);
  }

  return buildFallbackMemory({
    PERSONALITY: sections.PERSONALITY,
    ACTIVE_INTERESTS: formatActiveInterestBullets([...activeCore.values()], [...activeSide.values()]),
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
  const existingFeedback = sections ? parseBulletLines(sections.RECENT_FEEDBACK) : [];

  const personality = buildOrderedMap(existingPersonality);
  const activeCore = buildOrderedMap(existingActiveLanes.core);
  const activeSide = buildOrderedMap(existingActiveLanes.side);
  const feedback = buildOrderedMap(existingFeedback);

  removeMany(personality, ops.personality_remove);
  addMany(personality, ops.personality_add);

  const addActive = expandTopicValues(ops.add_active);
  const addActiveCore = expandTopicValues(ops.add_active_core);
  const addActiveSide = expandTopicValues(ops.add_active_side);
  const removeActive = expandTopicValues(ops.remove_active);
  const moveCoreToSide = expandTopicValues(ops.move_core_to_side);
  const moveSideToCore = expandTopicValues(ops.move_side_to_core);

  removeMany(activeCore, removeActive);
  removeMany(activeSide, removeActive);

  removeMany(activeCore, moveCoreToSide);
  addMany(activeSide, moveCoreToSide);

  removeMany(activeSide, moveSideToCore);
  addMany(activeCore, moveSideToCore);

  const mergedCoreAdds = uniqueLines([...addActive, ...addActiveCore]);
  removeMany(activeSide, mergedCoreAdds);
  addMany(activeCore, mergedCoreAdds);

  removeMany(activeCore, addActiveSide);
  addMany(activeSide, addActiveSide);

  for (const key of activeCore.keys()) {
    activeSide.delete(key);
  }

  const feedbackLines = ops.recent_feedback_add.length > 0 ? ops.recent_feedback_add : [inboundReplyText];
  addMany(feedback, feedbackLines);

  const condensedFeedback = [...feedback.values()].slice(-MAX_RECENT_FEEDBACK_LINES);

  return buildFallbackMemory({
    PERSONALITY: toBullets([...personality.values()]),
    ACTIVE_INTERESTS: formatActiveInterestBullets([...activeCore.values()], [...activeSide.values()]),
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
    RECENT_FEEDBACK: "- Initialized from onboarding brain dump"
  });
}

export function buildFallbackReplyMemory(currentMemory: string, inboundReplyText: string): string {
  const sections = parseSections(currentMemory);
  const existingFeedback = sections ? parseBulletLines(sections.RECENT_FEEDBACK) : [];
  const feedback = buildOrderedMap(existingFeedback);
  addMany(feedback, [inboundReplyText]);
  const condensedFeedback = [...feedback.values()].slice(-MAX_RECENT_FEEDBACK_LINES);

  if (sections) {
    return buildFallbackMemory({
      PERSONALITY: sections.PERSONALITY,
      ACTIVE_INTERESTS: sections.ACTIVE_INTERESTS,
      RECENT_FEEDBACK: toBullets(condensedFeedback)
    });
  }

  return buildFallbackMemory({
    PERSONALITY: "- Evolving learner profile",
    ACTIVE_INTERESTS: toBullets(extractInterestSignals(inboundReplyText).slice(0, 12)),
    RECENT_FEEDBACK: toBullets(condensedFeedback.length > 0 ? condensedFeedback : [inboundReplyText])
  });
}

export function appendRecentFeedbackLines(currentMemory: string, feedbackLines: string[]): string {
  const nextFeedbackLines = feedbackLines.map((line) => cleanLine(line)).filter(Boolean);
  if (nextFeedbackLines.length === 0) {
    const validatedCurrent = validateMemoryText(currentMemory);
    return validatedCurrent.ok
      ? validatedCurrent.memoryText
      : buildFallbackMemory({
          PERSONALITY: "- Evolving learner profile",
          ACTIVE_INTERESTS: "- General curiosity",
          RECENT_FEEDBACK: "-"
        });
  }

  const sections = parseSections(currentMemory);
  if (sections) {
    const existingFeedback = parseBulletLinesPreserveOrder(sections.RECENT_FEEDBACK);
    const condensedFeedback = [...existingFeedback, ...nextFeedbackLines].slice(-MAX_RECENT_FEEDBACK_LINES);
    return buildFallbackMemory({
      PERSONALITY: sections.PERSONALITY,
      ACTIVE_INTERESTS: sections.ACTIVE_INTERESTS,
      RECENT_FEEDBACK: toBullets(condensedFeedback)
    });
  }

  const condensedFeedback = nextFeedbackLines.slice(-MAX_RECENT_FEEDBACK_LINES);
  return buildFallbackMemory({
    PERSONALITY: "- Evolving learner profile",
    ACTIVE_INTERESTS: "- General curiosity",
    RECENT_FEEDBACK: toBullets(condensedFeedback)
  });
}

async function generateOnboardingMemoryRequired(prompt: string): Promise<string> {
  for (let attempt = 0; attempt < MEMORY_MODEL_RETRIES; attempt += 1) {
    try {
      const generated = await callMemoryModel({
        systemPrompt: ONBOARDING_MEMORY_SYSTEM_PROMPT,
        userPrompt: prompt
      });
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

  throw new Error("ONBOARDING_MODEL_REQUIRED");
}

async function generateReplyMemoryWithFallback(
  currentMemory: string,
  inboundReplyText: string,
  prompt: string,
  fallbackMemory: string
): Promise<string> {
  for (let attempt = 0; attempt < MEMORY_MODEL_RETRIES; attempt += 1) {
    try {
      const generated = await callMemoryModel({
        systemPrompt: REPLY_MEMORY_SYSTEM_PROMPT,
        userPrompt: prompt
      });
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
  const prompt = buildOnboardingMemoryPrompt(brainDumpText);
  const generated = await generateOnboardingMemoryRequired(prompt);
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
