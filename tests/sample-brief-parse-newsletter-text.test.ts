import { describe, expect, it } from "vitest";
import { parseNewsletterText } from "@/lib/sample-brief/parse-newsletter-text";

describe("parseNewsletterText", () => {
  it("extracts numbered items and quote from newsletter text", () => {
    const input = [
      "Hi Naman,",
      "",
      "Here is your first issue with 2 curated links.",
      "",
      "1. First Title",
      "Short factual summary for the first item.",
      "https://example.com/first",
      "More like this: https://example.com/more1",
      "Less like this: https://example.com/less1",
      "",
      "2. Second Title",
      "Serendipity pick: new territory you may find useful.",
      "Second summary paragraph that matters.",
      "https://example.com/second",
      "",
      'Quote of the Day:',
      '"Stay curious."',
      "- Jane Doe",
      "",
      "Reply with what you want more or less of, and tomorrow's issue will adapt."
    ].join("\n");

    const parsed = parseNewsletterText(input);

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toEqual({
      title: "First Title",
      url: "https://example.com/first",
      summary: "Short factual summary for the first item."
    });
    expect(parsed.items[1]).toEqual({
      title: "Second Title",
      url: "https://example.com/second",
      summary: "Second summary paragraph that matters."
    });
    expect(parsed.quote).toEqual({ text: "Stay curious.", author: "Jane Doe" });
  });

  it("returns empty items when input has no numbered blocks", () => {
    const parsed = parseNewsletterText("No numbered items here.");
    expect(parsed.items).toEqual([]);
    expect(parsed.quote).toBeNull();
  });
});

