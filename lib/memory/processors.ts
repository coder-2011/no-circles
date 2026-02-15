import {
  MEMORY_HEADERS,
  MEMORY_WORD_CAP,
  enforceWordCap,
  parseSections,
  formatSections,
  validateMemoryText
} from "@/lib/memory/contract";
import { buildOnboardingMemoryPrompt, buildReplyMemoryPrompt } from "@/lib/ai/memory-prompts";
import { memoryUpdateOpsSchema } from "@/lib/schemas";
import type { z } from "zod";

type GenerateMemoryArgs = {
  systemPrompt: string;
};

const DEFAULT_MEMORY_MODEL = "claude-3-5-sonnet-20240620";
const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const MEMORY_MODEL_RETRIES = 2;
const MAX_RECENT_FEEDBACK_LINES = 8;
const SUPPRESSED_INTEREST_REGEX = /\b(less|avoid|mute|stop|not interested|don't want|no more)\b/i;

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const modelName = process.env.ANTHROPIC_MEMORY_MODEL ?? DEFAULT_MEMORY_MODEL;

  if (!apiKey) {
    throw new Error("MISSING_ANTHROPIC_API_KEY");
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
  const existingActive = sections ? parseBulletLines(sections.ACTIVE_INTERESTS) : [];
  const existingSuppressed = sections ? parseBulletLines(sections.SUPPRESSED_INTERESTS) : [];
  const existingFeedback = sections ? parseBulletLines(sections.RECENT_FEEDBACK) : [];

  const personality = buildOrderedMap(existingPersonality);
  const active = buildOrderedMap(existingActive);
  const suppressed = buildOrderedMap(existingSuppressed);
  const feedback = buildOrderedMap(existingFeedback);

  removeMany(personality, ops.personality_remove);
  addMany(personality, ops.personality_add);

  removeMany(active, ops.remove_active);
  removeMany(suppressed, ops.remove_suppressed);

  removeMany(active, ops.add_suppressed);
  addMany(suppressed, ops.add_suppressed);

  removeMany(suppressed, ops.add_active);
  addMany(active, ops.add_active);

  const feedbackLines = ops.recent_feedback_add.length > 0 ? ops.recent_feedback_add : [inboundReplyText];
  addMany(feedback, feedbackLines);

  const condensedFeedback = [...feedback.values()].slice(-MAX_RECENT_FEEDBACK_LINES);

  return buildFallbackMemory({
    PERSONALITY: toBullets([...personality.values()]),
    ACTIVE_INTERESTS: toBullets([...active.values()]),
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

function extractSuppressedSignals(text: string): string[] {
  return extractUniqueSegments(text, /[\n.!?]/, (sentence) => SUPPRESSED_INTEREST_REGEX.test(sentence));
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
  const suppressed = extractSuppressedSignals(inboundReplyText).slice(0, 12);
  const sections = parseSections(currentMemory);

  return buildFallbackMemory({
    PERSONALITY: sections?.PERSONALITY || "- Evolving learner profile",
    ACTIVE_INTERESTS: toBullets(
      addedInterests.length > 0 ? addedInterests : ["No new explicit additions from latest reply"]
    ),
    SUPPRESSED_INTERESTS: toBullets(
      suppressed.length > 0 ? suppressed : ["No new explicit suppressions from latest reply"]
    ),
    RECENT_FEEDBACK: toBullets([inboundReplyText])
  });
}

async function generateWithFallback(prompt: string, fallbackMemory: string): Promise<string> {
  for (let attempt = 0; attempt < MEMORY_MODEL_RETRIES; attempt += 1) {
    try {
      const generated = await callMemoryModel({ systemPrompt: prompt });
      const validated = validateMemoryText(generated);

      if (validated.ok) {
        return validated.memoryText;
      }
    } catch {
      // Retry once before fallback.
    }
  }

  return fallbackMemory;
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
        continue;
      }

      const merged = buildMemoryFromReplyOps(currentMemory, inboundReplyText, parsedOps.data);
      const validated = validateMemoryText(merged);

      if (validated.ok) {
        return validated.memoryText;
      }
    } catch {
      // Retry once before fallback.
    }
  }

  return fallbackMemory;
}

export async function formatOnboardingMemory(brainDumpText: string): Promise<string> {
  const fallbackMemory = buildFallbackOnboardingMemory(brainDumpText);
  const prompt = buildOnboardingMemoryPrompt(brainDumpText);
  return generateWithFallback(prompt, fallbackMemory);
}

export async function mergeReplyIntoMemory(
  currentInterestMemoryText: string,
  inboundReplyText: string
): Promise<string> {
  const fallbackMemory = buildFallbackReplyMemory(currentInterestMemoryText, inboundReplyText);
  const prompt = buildReplyMemoryPrompt(currentInterestMemoryText, inboundReplyText);
  return generateReplyMemoryWithFallback(currentInterestMemoryText, inboundReplyText, prompt, fallbackMemory);
}
