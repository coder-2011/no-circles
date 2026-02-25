export type SampleBriefItem = {
  title: string;
  url: string;
  summary: string;
};

export type ParsedNewsletterText = {
  items: SampleBriefItem[];
  quote: { text: string; author: string } | null;
};

const ITEM_BLOCK_REGEX = /(?:^|\n)(\d+)\.\s([^\n]+)\n([\s\S]*?)(?=\n\d+\.\s|\nQuote of the Day:|\nReply with|\n$)/g;

function normalizeText(input: string): string {
  return input.replace(/\r\n?/g, "\n").trim();
}

function extractQuote(text: string): { text: string; author: string } | null {
  const match = text.match(/(?:^|\n)Quote of the Day:\n"([\s\S]*?)"\n-\s(.+?)(?:\n|$)/);
  if (!match) {
    return null;
  }

  const quoteText = (match[1] ?? "").trim();
  const quoteAuthor = (match[2] ?? "").trim();

  if (!quoteText || !quoteAuthor) {
    return null;
  }

  return { text: quoteText, author: quoteAuthor };
}

function extractItemFromBlock(blockTitle: string, blockBody: string): SampleBriefItem | null {
  const title = blockTitle.trim();
  if (!title) {
    return null;
  }

  const lines = blockBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const url = lines.find((line) => /^https?:\/\//i.test(line)) ?? "";
  if (!url) {
    return null;
  }

  const summary = lines
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !/^More like this:/i.test(line))
    .filter((line) => !/^Less like this:/i.test(line))
    .filter((line) => !/^Serendipity pick:/i.test(line))
    .join(" ")
    .trim();

  if (!summary) {
    return null;
  }

  return { title, url, summary };
}

export function parseNewsletterText(text: string): ParsedNewsletterText {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { items: [], quote: null };
  }

  const items: SampleBriefItem[] = [];

  for (const match of normalized.matchAll(ITEM_BLOCK_REGEX)) {
    const title = (match[2] ?? "").trim();
    const body = (match[3] ?? "").trim();
    const item = extractItemFromBlock(title, body);
    if (!item) {
      continue;
    }

    items.push(item);
    if (items.length >= 10) {
      break;
    }
  }

  return {
    items,
    quote: extractQuote(normalized)
  };
}

