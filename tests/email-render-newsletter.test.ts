import { describe, expect, it } from "vitest";
import { renderNewsletter } from "@/lib/email/render-newsletter";

describe("renderNewsletter", () => {
  it("renders subject, html, and text with 10 item blocks", () => {
    const items = Array.from({ length: 10 }).map((_, index) => ({
      title: `Title ${index + 1}`,
      summary: `Summary ${index + 1}`,
      url: `https://example.com/${index + 1}`
    }));

    const rendered = renderNewsletter({
      preferredName: "Naman",
      timezone: "America/Los_Angeles",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      items
    });

    expect(rendered.subject).toContain("Your daily brief");
    expect(rendered.html).toContain("Hi Naman");
    expect(rendered.text).toContain("Hi Naman");
    expect(rendered.html.match(/<section/g)?.length ?? 0).toBe(10);
    expect(rendered.html).toContain('<a href="https://example.com/1" style="color: #000; text-decoration: none;">1. Title 1</a>');
    expect(rendered.text).toContain("10. Title 10");
    expect(rendered.html).toContain("Reply with what you want more or less of, and tomorrow's issue will adapt.");
    expect(rendered.text).toContain("Reply with what you want more or less of, and tomorrow's issue will adapt.");
  });

  it("falls back to safe greeting when preferred name is missing", () => {
    const rendered = renderNewsletter({
      preferredName: " ",
      timezone: "UTC",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      items: [{ title: "One", summary: "S", url: "https://example.com" }]
    });

    expect(rendered.html).toContain("Hi there");
    expect(rendered.text).toContain("Hi there");
  });

  it("renders welcome variant with short-first-issue subject and copy", () => {
    const rendered = renderNewsletter({
      preferredName: "Naman",
      timezone: "UTC",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      variant: "welcome",
      items: [
        { title: "One", summary: "S1", url: "https://example.com/1" },
        { title: "Two", summary: "S2", url: "https://example.com/2" },
        { title: "Three", summary: "S3", url: "https://example.com/3" }
      ]
    });

    expect(rendered.subject).toBe("Welcome to No Circles - your first issue");
    expect(rendered.html).toContain("Hey, what’s up, I’m Naman, the solo dev behind The No-Circles Project.");
    expect(rendered.html).toContain("<u><em>you</em></u>");
    expect(rendered.html).toContain("<strong>TLDR; If we give you better inputs, you make better ideas!</strong>");
    expect(rendered.text).toContain("Hey, what’s up, I’m Naman, the solo dev behind The No-Circles Project.");
    expect(rendered.text).toContain("TLDR; If we give you better inputs, you make better ideas!");
    expect(rendered.text).toContain("3. Three");
  });
});
