export const MEMORY_HEADERS = [
  "PERSONALITY",
  "ACTIVE_INTERESTS",
  "SUPPRESSED_INTERESTS",
  "RECENT_FEEDBACK"
] as const;

export const MEMORY_WORD_CAP = 800;

type MemoryHeader = (typeof MEMORY_HEADERS)[number];

export function countWords(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

export function hasRequiredHeaders(text: string): boolean {
  return MEMORY_HEADERS.every((header) => text.includes(`${header}:`));
}

export function parseSections(text: string): Record<MemoryHeader, string> | null {
  if (!hasRequiredHeaders(text)) {
    return null;
  }

  const sections = {} as Record<MemoryHeader, string>;

  for (let i = 0; i < MEMORY_HEADERS.length; i += 1) {
    const currentHeader = MEMORY_HEADERS[i];
    const currentToken = `${currentHeader}:`;
    const startIndex = text.indexOf(currentToken);

    if (startIndex === -1) {
      return null;
    }

    const bodyStart = startIndex + currentToken.length;
    const nextHeader = MEMORY_HEADERS[i + 1];
    const bodyEnd = nextHeader ? text.indexOf(`${nextHeader}:`) : text.length;

    if (bodyEnd === -1) {
      return null;
    }

    sections[currentHeader] = text.slice(bodyStart, bodyEnd).trim();
  }

  return sections;
}

export function formatSections(sections: Record<MemoryHeader, string>): string {
  return MEMORY_HEADERS.map((header) => `${header}:\n${sections[header].trim() || "-"}`).join("\n\n");
}

export function enforceWordCap(text: string, cap = MEMORY_WORD_CAP): string {
  const words = text.trim().split(/\s+/);

  if (!text.trim() || words.length <= cap) {
    return text.trim();
  }

  return `${words.slice(0, cap).join(" ")}\n\n[TRUNCATED_TO_${cap}_WORDS]`;
}

export function validateMemoryText(text: string):
  | { ok: true; memoryText: string }
  | { ok: false; reason: string } {
  const normalized = text.trim();

  if (!normalized) {
    return { ok: false, reason: "Memory text is empty." };
  }

  const capped = enforceWordCap(normalized, MEMORY_WORD_CAP);
  const sections = parseSections(capped);

  if (!sections) {
    return { ok: false, reason: "Missing required memory headers." };
  }

  return { ok: true, memoryText: formatSections(sections) };
}
