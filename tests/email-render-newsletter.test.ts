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
    expect(rendered.text).toContain("10. Title 10");
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
});
