export const MEMORY_HEADERS = [
  "PERSONALITY",
  "ACTIVE_INTERESTS",
  "RECENT_FEEDBACK"
] as const;

const LEGACY_MEMORY_HEADERS = [
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
  if (!text.trim()) {
    return null;
  }

  const parsed = text.includes("SUPPRESSED_INTERESTS:")
    ? parseSectionsWithHeaders(text, LEGACY_MEMORY_HEADERS) ?? parseSectionsWithHeaders(text, MEMORY_HEADERS)
    : parseSectionsWithHeaders(text, MEMORY_HEADERS) ?? parseSectionsWithHeaders(text, LEGACY_MEMORY_HEADERS);
  if (!parsed) {
    return null;
  }

  return {
    PERSONALITY: parsed.PERSONALITY,
    ACTIVE_INTERESTS: parsed.ACTIVE_INTERESTS,
    RECENT_FEEDBACK: parsed.RECENT_FEEDBACK
  };
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

function capSectionsToWordLimit(
  sections: Record<MemoryHeader, string>,
  cap = MEMORY_WORD_CAP
): Record<MemoryHeader, string> {
  const sectionWords = Object.fromEntries(
    MEMORY_HEADERS.map((header) => [
      header,
      sections[header]
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean)
    ])
  ) as Record<MemoryHeader, string[]>;

  const formattedWordCount = () =>
    countWords(
      formatSections(
        Object.fromEntries(MEMORY_HEADERS.map((header) => [header, sectionWords[header].join(" ") || "-"])) as Record<
          MemoryHeader,
          string
        >
      )
    );

  while (formattedWordCount() > cap) {
    const reducibleHeader = MEMORY_HEADERS
      .filter((header) => sectionWords[header].length > 1)
      .sort((a, b) => sectionWords[b].length - sectionWords[a].length)[0];

    if (!reducibleHeader) {
      break;
    }

    sectionWords[reducibleHeader].pop();
  }

  return Object.fromEntries(
    MEMORY_HEADERS.map((header) => [header, sectionWords[header].join(" ") || "-"])
  ) as Record<MemoryHeader, string>;
}

function parseSectionsWithHeaders<const THeaders extends readonly string[]>(
  text: string,
  headers: THeaders
): Record<THeaders[number], string> | null {
  if (!headers.every((header) => text.includes(`${header}:`))) {
    return null;
  }

  const sections = {} as Record<THeaders[number], string>;

  for (let i = 0; i < headers.length; i += 1) {
    const currentHeader = headers[i] as THeaders[number];
    const currentToken = `${currentHeader}:`;
    const startIndex = text.indexOf(currentToken);

    if (startIndex === -1) {
      return null;
    }

    const bodyStart = startIndex + currentToken.length;
    const nextHeader = headers[i + 1] as THeaders[number] | undefined;
    const bodyEnd = nextHeader ? text.indexOf(`${nextHeader}:`) : text.length;

    if (bodyEnd === -1) {
      return null;
    }

    sections[currentHeader] = text.slice(bodyStart, bodyEnd).trim();
  }

  return sections;
}

export function validateMemoryText(text: string):
  | { ok: true; memoryText: string }
  | { ok: false; reason: string } {
  const normalized = text.trim();

  if (!normalized) {
    return { ok: false, reason: "Memory text is empty." };
  }

  const sections = parseSections(normalized);

  if (!sections) {
    return { ok: false, reason: "Missing required memory headers." };
  }

  const cappedSections = capSectionsToWordLimit(sections, MEMORY_WORD_CAP);
  return { ok: true, memoryText: formatSections(cappedSections) };
}
