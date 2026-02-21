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
        `<section style=\"margin: 0 0 14px; border: 1px solid #D8CFB4; background: #F7F2E2; border-radius: 12px; padding: 14px 16px;\">`,
        `<h3 style=\"margin: 0 0 8px; font-size: 19px; line-height: 1.35; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600;\">`,
        `<a href=\"${escapeHtml(item.url)}\" style=\"color: #2D3426; text-decoration: underline; text-decoration-color: #8B9A7A; text-decoration-thickness: 2px; text-underline-offset: 4px;\">${index + 1}. ${escapeHtml(item.title)}</a>`,
        `</h3>`,
        `<p style=\"margin: 0 0 8px; line-height: 1.6; color: #4A5641; font-size: 15px;\">${escapeHtml(item.summary)}</p>`,
        `<p style=\"margin: 0;\"><a href=\"${escapeHtml(item.url)}\" style=\"color: #5D6A52; font-size: 13px;\">${escapeHtml(item.url)}</a></p>`,
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
    `<div style=\"font-family: 'Source Sans 3', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; background: #F3ECD8; color: #2D3426; max-width: 720px; margin: 0 auto; padding: 24px;\">`,
    `<div style=\"border: 1px solid #C9BD9A; background: #FBF7EB; border-radius: 18px; padding: 20px;\">`,
    `<h2 style=\"margin: 0 0 8px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 34px; line-height: 1.15; color: #2B3125;\">Hi ${escapeHtml(greetingName)},</h2>`,
    variant === "welcome"
      ? [
          `<p style=\"line-height: 1.6; color: #4A5641; margin: 0 0 12px;\">Hey, what’s up, I’m Naman, the solo dev behind The No-Circles Project.</p>`,
          `<p style=\"line-height: 1.6; color: #4A5641; margin: 0 0 12px;\">I built this because most of us end up reading the same things as everyone else in our field, and that usually leads to similar ideas.</p>`,
          `<p style=\"line-height: 1.6; color: #4A5641; margin: 0 0 12px;\">The No-Circles Project is my attempt to break that pattern. If you want to come up with great ideas, you can't just read what everyone else in your field is reading. I built this project to help you break that pattern.</p>`,
          `<p style=\"line-height: 1.6; color: #4A5641; margin: 0 0 12px;\">You tell it what you care about, and it works its magic to find you great information outside your usual bubble, stuff you didn't know you wanted to read, but is still very <u><em>you</em></u>. <u>Reply with what you want more or less of, and tomorrow's issue will adapt.</u></p>`,
          `<p style=\"line-height: 1.6; color: #2D3426; margin: 0 0 14px;\"><strong>TLDR; If we give you better inputs, you make better ideas!</strong></p>`
        ].join("\n")
      : `<p style=\"line-height: 1.6; color: #4A5641; margin: 0 0 14px;\">Here are your ${itemCount} curated links for today.</p>`,
    htmlItems,
    `<hr style=\"margin: 24px 0; border: 0; border-top: 1px solid #C9BD9A;\"/>`,
    variant === "welcome"
      ? `<p style=\"color: #526149; font-size: 14px; margin: 0;\">You’re always in control of this feed.</p>`
      : `<p style=\"color: #526149; font-size: 14px; margin: 0;\"><strong style=\"font-size: 16px; color: #1F5E2E;\">Reply with what you want more or less of, and tomorrow's issue will adapt.</strong></p>`,
    `</div>`,
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
          "You tell it what you care about, and it works its magic to find you great information outside your usual bubble, stuff you didn't know you wanted to read, but is still very you. Reply with what you want more or less of, and tomorrow's issue will adapt.",
          "",
          "TLDR; If we give you better inputs, you make better ideas!"
        ].join("\n")
      : `Here are your ${itemCount} curated links for today.`,
    "",
    textItems,
    "",
    variant === "welcome"
      ? "You're always in control of this feed."
      : "Reply with what you want more or less of, and tomorrow's issue will adapt."
  ].join("\n");

  return { subject, html, text };
}
