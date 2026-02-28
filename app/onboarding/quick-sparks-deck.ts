import { shuffleQuickSparks } from "@/app/onboarding/onboarding-config";

export type QuickSparksDeck = {
  unseen: string[];
  seen: string[];
};

function dedupeDeckItems(items: string[], allowed: Set<string>, seenKeys: Set<string>): string[] {
  return items.filter((item) => {
    if (!allowed.has(item) || seenKeys.has(item)) {
      return false;
    }

    seenKeys.add(item);
    return true;
  });
}

export function parseQuickSparksText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function restoreQuickSparksDeck(args: {
  allItems: string[];
  savedDeckRaw: string | null;
}): QuickSparksDeck {
  const allowed = new Set(args.allItems);
  let unseen: string[] = [];
  let seen: string[] = [];

  if (args.savedDeckRaw) {
    try {
      const parsedDeck = JSON.parse(args.savedDeckRaw) as { unseen?: string[]; seen?: string[] };
      const dedupe = new Set<string>();
      unseen = Array.isArray(parsedDeck.unseen) ? dedupeDeckItems(parsedDeck.unseen, allowed, dedupe) : [];
      seen = Array.isArray(parsedDeck.seen) ? dedupeDeckItems(parsedDeck.seen, allowed, dedupe) : [];
    } catch {
      unseen = [];
      seen = [];
    }
  }

  if (unseen.length + seen.length < args.allItems.length) {
    const existing = new Set([...unseen, ...seen]);
    const missing = args.allItems.filter((item) => !existing.has(item));
    unseen = [...unseen, ...shuffleQuickSparks(missing)];
  }

  if (unseen.length === 0 && seen.length > 0) {
    unseen = shuffleQuickSparks(seen);
    seen = [];
  }

  return { unseen, seen };
}

export function drawQuickSparksBatch(args: {
  unseen: string[];
  seen: string[];
  count: number;
}): {
  selected: string[];
  deck: QuickSparksDeck;
} {
  const unseen = [...args.unseen];
  const seen = [...args.seen];
  const selected: string[] = [];

  while (selected.length < args.count) {
    if (unseen.length === 0) {
      if (seen.length === 0) {
        break;
      }

      unseen.push(...shuffleQuickSparks(seen));
      seen.length = 0;
    }

    const next = unseen.shift();
    if (!next) {
      break;
    }

    selected.push(next);
    seen.push(next);
  }

  return {
    selected,
    deck: {
      unseen,
      seen
    }
  };
}
