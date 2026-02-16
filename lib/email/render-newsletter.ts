import { formatInTimeZone } from "date-fns-tz";
import type { NewsletterSummaryItem } from "@/lib/summary/writer";

type RenderNewsletterArgs = {
  preferredName: string | null;
  timezone: string;
  runAtUtc: Date;
  items: NewsletterSummaryItem[];
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
  const subject = `Your daily brief for ${localDateLabel}`;
  const greetingName = resolveGreetingName(args.preferredName);

  const htmlItems = args.items
    .map((item, index) => {
      return [
        `<section style=\"margin: 0 0 20px;\">`,
        `<h3 style=\"margin: 0 0 8px; font-size: 18px;\">${index + 1}. ${escapeHtml(item.title)}</h3>`,
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
    `<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px;\">`,
    `<h2 style=\"margin-top: 0;\">Hi ${escapeHtml(greetingName)},</h2>`,
    `<p style=\"line-height: 1.5;\">Here are your 10 curated links for today.</p>`,
    htmlItems,
    `<hr style=\"margin: 24px 0; border: 0; border-top: 1px solid #ddd;\"/>`,
    `<p style=\"color: #666; font-size: 14px;\">Reply to this email anytime to tune what you want more or less of tomorrow.</p>`,
    `</div>`
  ].join("\n");

  const text = [`Hi ${greetingName},`, "", "Here are your 10 curated links for today.", "", textItems, "", "Reply to this email anytime to tune tomorrow's issue."].join("\n");

  return { subject, html, text };
}
