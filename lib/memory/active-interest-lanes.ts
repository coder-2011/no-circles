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

export function parseActiveInterestLanes(section: string): { core: string[]; side: string[] } {
  const core = new Map<string, string>();
  const side = new Map<string, string>();

  for (const rawLine of section.split("\n")) {
    const cleaned = cleanLine(rawLine);
    if (!cleaned || cleaned === "-") {
      continue;
    }

    const match = cleaned.match(/^\[(core|side)\]\s*(.+)$/i);
    const lane = (match?.[1]?.toLowerCase() ?? "core") as "core" | "side";
    const payload = (match?.[2] ?? cleaned).trim();
    const topics = splitCompoundTopicLine(payload);

    for (const topic of topics) {
      const key = topic.toLowerCase();
      if (lane === "side") {
        if (!core.has(key) && !side.has(key)) {
          side.set(key, topic);
        }
        continue;
      }

      if (!core.has(key)) {
        core.set(key, topic);
      }
      side.delete(key);
    }
  }

  return {
    core: [...core.values()],
    side: [...side.values()]
  };
}
