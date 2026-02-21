import { formatInTimeZone } from "date-fns-tz";
import type { NewsletterSummaryItem } from "@/lib/summary/writer";

type RenderNewsletterArgs = {
  preferredName: string | null;
  timezone: string;
  runAtUtc: Date;
  items: NewsletterSummaryItem[];
  variant?: "daily" | "welcome";
};

export type RenderedNewsletter = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveGreetingName(preferredName: string | null): string {
  const normalized = preferredName?.trim();
  return normalized && normalized.length > 0 ? normalized : "there";
}

export function renderNewsletter(args: RenderNewsletterArgs): RenderedNewsletter {
  const localDateLabel = formatInTimeZone(args.runAtUtc, args.timezone, "EEEE, MMMM d");
  const variant = args.variant ?? "daily";
  const subject =
    variant === "welcome" ? "Welcome to No Circles - your first issue" : `Your daily brief for ${localDateLabel}`;
  const greetingName = resolveGreetingName(args.preferredName);
  const itemCount = args.items.length;

  const htmlItems = args.items
    .map((item, index) => {
      return [
        `<section style=\"margin: 0 0 20px;\">`,
        `<h3 style=\"margin: 0 0 8px; font-size: 18px;\">`,
        `<a href=\"${escapeHtml(item.url)}\" style=\"color: #000; text-decoration: none;\">${index + 1}. ${escapeHtml(item.title)}</a>`,
        `</h3>`,
        `<p style=\"margin: 0 0 8px; line-height: 1.5;\">${escapeHtml(item.summary)}</p>`,
        `<p style=\"margin: 0;\"><a href=\"${escapeHtml(item.url)}\">${escapeHtml(item.url)}</a></p>`,
        `</section>`
      ].join("\n");
    })
    .join("\n");

  const textItems = args.items
    .map((item, index) => {
      return [`${index + 1}. ${item.title}`, item.summary, item.url].join("\n");
    })
    .join("\n\n");

  const html = [
    `<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF4E6; color: #2D3426; max-width: 720px; margin: 0 auto; padding: 24px;\">`,
    `<h2 style=\"margin-top: 0;\">Hi ${escapeHtml(greetingName)},</h2>`,
    variant === "welcome"
      ? [
          `<p style=\"line-height: 1.5;\">Hey, what’s up, I’m Naman, the solo dev behind The No-Circles Project.</p>`,
          `<p style=\"line-height: 1.5;\">I built this because most of us end up reading the same things as everyone else in our field, and that usually leads to similar ideas.</p>`,
          `<p style=\"line-height: 1.5;\">The No-Circles Project is my attempt to break that pattern. If you want to come up with great ideas, you can't just read what everyone else in your field is reading. I built this project to help you break that pattern.</p>`,
          `<p style=\"line-height: 1.5;\">You tell it what you care about, and it works its magic to find you great information outside your usual bubble, stuff you didn't know you wanted to read, but is still very <u><em>you</em></u>.</p>`,
          `<p style=\"line-height: 1.5;\"><strong>TLDR; If we give you better inputs, you make better ideas!</strong></p>`
        ].join("\n")
      : `<p style=\"line-height: 1.5;\">Here are your ${itemCount} curated links for today.</p>`,
    htmlItems,
    `<hr style=\"margin: 24px 0; border: 0; border-top: 1px solid #C9BD9A;\"/>`,
    `<p style=\"color: #526149; font-size: 14px;\">Reply with what you want more or less of, and tomorrow's issue will adapt.</p>`,
    `</div>`
  ].join("\n");

  const text = [
    `Hi ${greetingName},`,
    "",
    variant === "welcome"
      ? [
          "Hey, what’s up, I’m Naman, the solo dev behind The No-Circles Project.",
          "",
          "I built this because most of us end up reading the same things as everyone else in our field, and that usually leads to similar ideas.",
          "",
          "The No-Circles Project is my attempt to break that pattern. If you want to come up with great ideas, you can't just read what everyone else in your field is reading. I built this project to help you break that pattern.",
          "",
          "You tell it what you care about, and it works its magic to find you great information outside your usual bubble, stuff you didn't know you wanted to read, but is still very you.",
          "",
          "TLDR; If we give you better inputs, you make better ideas!"
        ].join("\n")
      : `Here are your ${itemCount} curated links for today.`,
    "",
    textItems,
    "",
    "Reply with what you want more or less of, and tomorrow's issue will adapt."
  ].join("\n");

  return { subject, html, text };
}
