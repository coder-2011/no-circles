import { describe, expect, it } from "vitest";
import {
  getNewsletterThemeTemplateKeys,
  pickRandomNewsletterThemeTemplate,
  renderNewsletter
} from "@/lib/email/render-newsletter";

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
    expect(rendered.html).toContain('<a href="https://example.com/1"');
    expect(rendered.html).toContain(">1. Title 1</a>");
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
    expect(rendered.html).toContain("Here is your first issue with 3 curated links.");
    expect(rendered.text).toContain("Here is your first issue with 3 curated links.");
    expect(rendered.html).not.toContain("Hey, what’s up, I’m Naman, the solo dev behind The No-Circles Project.");
    expect(rendered.text).not.toContain("Hey, what’s up, I’m Naman, the solo dev behind The No-Circles Project.");
    expect(rendered.text).toContain("3. Three");
    expect(rendered.text).toContain("Reply with what you want more or less of, and tomorrow's issue will adapt.");
  });

  it("marks serendipitous items in html and text", () => {
    const rendered = renderNewsletter({
      preferredName: "Naman",
      timezone: "UTC",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      items: [
        { title: "Core Item", summary: "Core summary", url: "https://example.com/core" },
        {
          title: "Adjacent Discovery",
          summary: "Discovery summary",
          url: "https://example.com/discovery",
          isSerendipitous: true
        }
      ]
    });

    expect(rendered.html).toContain("Serendipity pick:");
    expect(rendered.text).toContain("Serendipity pick: new territory you may find useful.");
  });

  it("renders in-email feedback links when provided", () => {
    const rendered = renderNewsletter({
      preferredName: "Naman",
      timezone: "UTC",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      items: [{ title: "Core Item", summary: "Core summary", url: "https://example.com/core" }],
      feedbackLinksByItemUrl: {
        "https://example.com/core": {
          moreLikeThisUrl: "https://nocircles.app/api/feedback/click?token=more",
          lessLikeThisUrl: "https://nocircles.app/api/feedback/click?token=less"
        }
      }
    });

    expect(rendered.html).toContain(">More like this</a>");
    expect(rendered.html).toContain(">Less like this</a>");
    expect(rendered.html).toContain('target="_blank"');
    expect(rendered.html).toContain('rel="noopener noreferrer"');
    expect(rendered.text).toContain("More like this: https://nocircles.app/api/feedback/click?token=more");
    expect(rendered.text).toContain("Less like this: https://nocircles.app/api/feedback/click?token=less");
  });

  it("renders personalized quote inline above the reply line when quote is provided", () => {
    const rendered = renderNewsletter({
      preferredName: "Naman",
      timezone: "UTC",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      items: [{ title: "Core Item", summary: "Core summary", url: "https://example.com/core" }],
      quote: {
        text: "The cure for boredom is curiosity. There is no cure for curiosity.",
        author: "Dorothy Parker",
        category: "curiosity"
      }
    });

    const replyLine = "Reply with what you want more or less of, and tomorrow's issue will adapt.";
    const quoteLabelIndex = rendered.html.indexOf("Quote of the Day");
    const replyIndex = rendered.html.indexOf(replyLine);

    expect(rendered.html).toContain("Quote of the Day");
    expect(rendered.html).toContain("Dorothy Parker");
    expect(quoteLabelIndex).toBeGreaterThan(-1);
    expect(replyIndex).toBeGreaterThan(-1);
    expect(quoteLabelIndex).toBeLessThan(replyIndex);
    expect(rendered.text).toContain("Quote of the Day:");
    expect(rendered.text).toContain("Dorothy Parker");
  });

  it("renders using selected template colors", () => {
    const rendered = renderNewsletter({
      preferredName: "Naman",
      timezone: "UTC",
      runAtUtc: new Date("2026-02-16T18:00:00.000Z"),
      themeTemplate: "06-coastal-brass",
      items: [{ title: "Core Item", summary: "Core summary", url: "https://example.com/core" }]
    });

    expect(rendered.html).toContain("background: #F3F6FB");
    expect(rendered.html).toContain("color: #3A6294");
  });

  it("picks random theme template by random source", () => {
    expect(pickRandomNewsletterThemeTemplate(() => 0)).toBe("01-riviera-sun");
    expect(pickRandomNewsletterThemeTemplate(() => 0.9999)).toBe("10-mint-fig");
    expect(getNewsletterThemeTemplateKeys().length).toBe(10);
  });
});
