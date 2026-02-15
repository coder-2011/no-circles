import {
  MEMORY_HEADERS,
  MEMORY_WORD_CAP,
  enforceWordCap,
  formatSections,
  validateMemoryText
} from "@/lib/memory/contract";
import { buildOnboardingMemoryPrompt, buildReplyMemoryPrompt } from "@/lib/ai/memory-prompts";

type GenerateMemoryArgs = {
  systemPrompt: string;
};

async function callMemoryModel(_args: GenerateMemoryArgs): Promise<string> {
  void _args;
  // Placeholder for future Claude integration.
  throw new Error("MODEL_NOT_CONFIGURED");
}

type MemorySections = Record<(typeof MEMORY_HEADERS)[number], string>;

function cleanLine(line: string): string {
  return line.replace(/^[-*\d.)\s]+/, "").trim();
}

function uniqueLines(lines: string[]): string[] {
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

function parseSection(memoryText: string, header: (typeof MEMORY_HEADERS)[number]): string {
  const token = `${header}:`;
  const start = memoryText.indexOf(token);

  if (start === -1) {
    return "";
  }

  const rest = memoryText.slice(start + token.length);
  const nextPosition = MEMORY_HEADERS
    .filter((candidate) => candidate !== header)
    .map((candidate) => rest.indexOf(`${candidate}:`))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  return (nextPosition === undefined ? rest : rest.slice(0, nextPosition)).trim();
}

function extractInterestSignals(text: string): string[] {
  const lines = text
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);

  return uniqueLines(lines);
}

function extractSuppressedSignals(text: string): string[] {
  const sentences = text
    .split(/[\n.!?]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return uniqueLines(
    sentences.filter((sentence) => /\b(less|avoid|mute|stop|not interested|don't want|no more)\b/i.test(sentence))
  );
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

  return buildFallbackMemory({
    PERSONALITY: parseSection(currentMemory, "PERSONALITY") || "- Evolving learner profile",
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
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
  return generateWithFallback(prompt, fallbackMemory);
}
