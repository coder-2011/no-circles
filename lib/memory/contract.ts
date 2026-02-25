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
