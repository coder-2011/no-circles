import { formatInTimeZone } from "date-fns-tz";
import type { NewsletterSummaryItem } from "@/lib/summary/writer";

type RenderNewsletterQuote = {
  text: string;
  author: string;
  category: string | null;
};

type NewsletterThemeTemplate = {
  outerBackground: string;
  panelBackground: string;
  panelBorder: string;
  itemBackground: string;
  itemBorder: string;
  headingText: string;
  bodyText: string;
  linkText: string;
  linkDecoration: string;
  urlText: string;
  serendipityText: string;
  quoteTitle: string;
  quoteBody: string;
  quoteAuthor: string;
  footerText: string;
  replyAccent: string;
  feedbackMoreBorder: string;
  feedbackMoreBackground: string;
  feedbackMoreText: string;
  feedbackLessBorder: string;
  feedbackLessBackground: string;
  feedbackLessText: string;
};

const NEWSLETTER_THEME_TEMPLATES = {
  "01-riviera-sun": {
    outerBackground: "#FBF7F2",
    panelBackground: "#FEFCF9",
    panelBorder: "#E8DCCD",
    itemBackground: "#F1F7F8",
    itemBorder: "#D5E3E5",
    headingText: "#2A2622",
    bodyText: "#47423D",
    linkText: "#2B6E77",
    linkDecoration: "#C79063",
    urlText: "#456B70",
    serendipityText: "#836347",
    quoteTitle: "#2E666F",
    quoteBody: "#3A3732",
    quoteAuthor: "#785C43",
    footerText: "#57504A",
    replyAccent: "#2D636A",
    feedbackMoreBorder: "#B7D1D5",
    feedbackMoreBackground: "#F4FAFB",
    feedbackMoreText: "#2D626A",
    feedbackLessBorder: "#D8C6B7",
    feedbackLessBackground: "#FBF6F1",
    feedbackLessText: "#7E5E45"
  },
  "02-orchid-meadow": {
    outerBackground: "#F8F4FF",
    panelBackground: "#FCFAFF",
    panelBorder: "#DDD3EF",
    itemBackground: "#F0F8F1",
    itemBorder: "#CEE2D1",
    headingText: "#28222F",
    bodyText: "#443E4D",
    linkText: "#2F7A53",
    linkDecoration: "#8660BC",
    urlText: "#6D4D97",
    serendipityText: "#5E6A9A",
    quoteTitle: "#2C714D",
    quoteBody: "#373240",
    quoteAuthor: "#62478C",
    footerText: "#524C5D",
    replyAccent: "#2C6C49",
    feedbackMoreBorder: "#BFDAC5",
    feedbackMoreBackground: "#F4FBF6",
    feedbackMoreText: "#2D6546",
    feedbackLessBorder: "#D3C6E6",
    feedbackLessBackground: "#F8F4FC",
    feedbackLessText: "#5E4A83"
  },
  "03-aurora-slate": {
    outerBackground: "#EFF8FF",
    panelBackground: "#F8FCFF",
    panelBorder: "#C9DFF0",
    itemBackground: "#F3F4FF",
    itemBorder: "#D7DAF5",
    headingText: "#1F2B38",
    bodyText: "#344555",
    linkText: "#4A57B8",
    linkDecoration: "#2AA6A1",
    urlText: "#2F7484",
    serendipityText: "#43618B",
    quoteTitle: "#2C6E9A",
    quoteBody: "#2A3440",
    quoteAuthor: "#3B5D92",
    footerText: "#445667",
    replyAccent: "#2E6690",
    feedbackMoreBorder: "#B9CCE6",
    feedbackMoreBackground: "#F3F7FD",
    feedbackMoreText: "#2F5F8D",
    feedbackLessBorder: "#C8D0EE",
    feedbackLessBackground: "#F5F6FD",
    feedbackLessText: "#445596"
  },
  "04-terracotta-sea": {
    outerBackground: "#FFF4EE",
    panelBackground: "#FFF9F5",
    panelBorder: "#F0D2C4",
    itemBackground: "#EEF9F8",
    itemBorder: "#CFE7E4",
    headingText: "#32261F",
    bodyText: "#504037",
    linkText: "#247A88",
    linkDecoration: "#C66A4C",
    urlText: "#9A5238",
    serendipityText: "#3A7380",
    quoteTitle: "#2E6E78",
    quoteBody: "#40322C",
    quoteAuthor: "#8A4C34",
    footerText: "#5F4A40",
    replyAccent: "#2F6C76",
    feedbackMoreBorder: "#BFDCDD",
    feedbackMoreBackground: "#F2FAFA",
    feedbackMoreText: "#2F6873",
    feedbackLessBorder: "#E3C8BE",
    feedbackLessBackground: "#FCF3F0",
    feedbackLessText: "#86513F"
  },
  "05-violet-sunlit": {
    outerBackground: "#F7F2FF",
    panelBackground: "#FCFAFF",
    panelBorder: "#DDD0F0",
    itemBackground: "#FFF7EE",
    itemBorder: "#F1DEC6",
    headingText: "#2C2536",
    bodyText: "#463E53",
    linkText: "#B2702C",
    linkDecoration: "#6C5AC4",
    urlText: "#8751A2",
    serendipityText: "#A46D2F",
    quoteTitle: "#6A59B6",
    quoteBody: "#393243",
    quoteAuthor: "#7D4896",
    footerText: "#554C61",
    replyAccent: "#674FB0",
    feedbackMoreBorder: "#D8C9EB",
    feedbackMoreBackground: "#F8F4FC",
    feedbackMoreText: "#654F9F",
    feedbackLessBorder: "#E6D2BC",
    feedbackLessBackground: "#FCF5EC",
    feedbackLessText: "#8E5C2B"
  },
  "06-coastal-brass": {
    outerBackground: "#F3F6FB",
    panelBackground: "#FAFCFE",
    panelBorder: "#D7DFEA",
    itemBackground: "#FBF6EE",
    itemBorder: "#E9DDCD",
    headingText: "#202B37",
    bodyText: "#3B4958",
    linkText: "#3A6294",
    linkDecoration: "#B99061",
    urlText: "#3A6B7E",
    serendipityText: "#7E6543",
    quoteTitle: "#385C8C",
    quoteBody: "#313C48",
    quoteAuthor: "#735A3E",
    footerText: "#4C5968",
    replyAccent: "#3B5A85",
    feedbackMoreBorder: "#C7D3E2",
    feedbackMoreBackground: "#F4F7FB",
    feedbackMoreText: "#3A5579",
    feedbackLessBorder: "#DED1C2",
    feedbackLessBackground: "#FAF5EE",
    feedbackLessText: "#745C42"
  },
  "07-merlot-ink": {
    outerBackground: "#FCF1F5",
    panelBackground: "#FFF8FB",
    panelBorder: "#E8CED8",
    itemBackground: "#F1F2FF",
    itemBorder: "#D8DAF2",
    headingText: "#2E2328",
    bodyText: "#4D3D45",
    linkText: "#4B56A5",
    linkDecoration: "#B45572",
    urlText: "#7F3F5A",
    serendipityText: "#655393",
    quoteTitle: "#A64A67",
    quoteBody: "#3C3037",
    quoteAuthor: "#644885",
    footerText: "#5B4A53",
    replyAccent: "#903E58",
    feedbackMoreBorder: "#D2CFE9",
    feedbackMoreBackground: "#F6F5FD",
    feedbackMoreText: "#584B89",
    feedbackLessBorder: "#E3CAD2",
    feedbackLessBackground: "#FDF2F6",
    feedbackLessText: "#7D465A"
  },
  "08-forest-cream": {
    outerBackground: "#F2F8F0",
    panelBackground: "#FAFDF8",
    panelBorder: "#D7E5D3",
    itemBackground: "#FFF6EC",
    itemBorder: "#F1E0C9",
    headingText: "#212C20",
    bodyText: "#3C4B39",
    linkText: "#B7762E",
    linkDecoration: "#3E8A4A",
    urlText: "#2D6C37",
    serendipityText: "#8B612F",
    quoteTitle: "#367A43",
    quoteBody: "#2D392A",
    quoteAuthor: "#7A5429",
    footerText: "#4A5846",
    replyAccent: "#336F3E",
    feedbackMoreBorder: "#C7DFCB",
    feedbackMoreBackground: "#F5FBF6",
    feedbackMoreText: "#336B3C",
    feedbackLessBorder: "#E7D6BF",
    feedbackLessBackground: "#FCF4EB",
    feedbackLessText: "#7F5A2B"
  },
  "09-midnight-coral": {
    outerBackground: "#EEF1FA",
    panelBackground: "#F7F9FF",
    panelBorder: "#D2D9ED",
    itemBackground: "#FFF1EE",
    itemBorder: "#F1D2CA",
    headingText: "#23273A",
    bodyText: "#3F455D",
    linkText: "#C45B4A",
    linkDecoration: "#4C63C7",
    urlText: "#7D4EA2",
    serendipityText: "#A14F43",
    quoteTitle: "#465BB8",
    quoteBody: "#30354A",
    quoteAuthor: "#8A4565",
    footerText: "#4C526A",
    replyAccent: "#4458B0",
    feedbackMoreBorder: "#C7D0EC",
    feedbackMoreBackground: "#F4F6FD",
    feedbackMoreText: "#4457A5",
    feedbackLessBorder: "#E6C9C3",
    feedbackLessBackground: "#FDF2EF",
    feedbackLessText: "#8C4D45"
  },
  "10-mint-fig": {
    outerBackground: "#EEF8F3",
    panelBackground: "#F8FFFB",
    panelBorder: "#CCE4D9",
    itemBackground: "#F6F2FF",
    itemBorder: "#DFD6F0",
    headingText: "#202D29",
    bodyText: "#3A4A45",
    linkText: "#6D4F9E",
    linkDecoration: "#2F8F75",
    urlText: "#2F755F",
    serendipityText: "#5E4A84",
    quoteTitle: "#2E836A",
    quoteBody: "#2F3A37",
    quoteAuthor: "#594278",
    footerText: "#4A5A55",
    replyAccent: "#2D7D65",
    feedbackMoreBorder: "#C8E0D5",
    feedbackMoreBackground: "#F4FBF7",
    feedbackMoreText: "#2F6E5C",
    feedbackLessBorder: "#D8D0E7",
    feedbackLessBackground: "#F8F5FC",
    feedbackLessText: "#5C4A80"
  }
} satisfies Record<string, NewsletterThemeTemplate>;

export type NewsletterThemeTemplateKey = keyof typeof NEWSLETTER_THEME_TEMPLATES;

const NEWSLETTER_THEME_TEMPLATE_KEYS = Object.keys(NEWSLETTER_THEME_TEMPLATES) as NewsletterThemeTemplateKey[];
const DEFAULT_NEWSLETTER_THEME_TEMPLATE: NewsletterThemeTemplateKey = "01-riviera-sun";

type RenderNewsletterArgs = {
  preferredName: string | null;
  timezone: string;
  runAtUtc: Date;
  items: NewsletterSummaryItem[];
  feedbackLinksByItemUrl?: Record<string, { moreLikeThisUrl: string; lessLikeThisUrl: string }>;
  quote?: RenderNewsletterQuote | null;
  variant?: "daily" | "welcome";
  themeTemplate?: NewsletterThemeTemplateKey;
};

export type RenderedNewsletter = {
  subject: string;
  html: string;
  text: string;
};

export function getNewsletterThemeTemplateKeys(): NewsletterThemeTemplateKey[] {
  return [...NEWSLETTER_THEME_TEMPLATE_KEYS];
}

export function pickRandomNewsletterThemeTemplate(randomFn: () => number = Math.random): NewsletterThemeTemplateKey {
  const index = Math.floor(randomFn() * NEWSLETTER_THEME_TEMPLATE_KEYS.length);
  return NEWSLETTER_THEME_TEMPLATE_KEYS[index] ?? DEFAULT_NEWSLETTER_THEME_TEMPLATE;
}

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
  const themeTemplate = args.themeTemplate ?? DEFAULT_NEWSLETTER_THEME_TEMPLATE;
  const theme = NEWSLETTER_THEME_TEMPLATES[themeTemplate] ?? NEWSLETTER_THEME_TEMPLATES[DEFAULT_NEWSLETTER_THEME_TEMPLATE];

  const subject =
    variant === "welcome" ? "Welcome to No Circles - your first issue" : `Your daily brief for ${localDateLabel}`;
  const greetingName = resolveGreetingName(args.preferredName);
  const itemCount = args.items.length;

  const htmlItems = args.items
    .map((item, index) => {
      const serendipityNote = item.isSerendipitous
        ? `<p style=\"margin: 0 0 8px; color: ${theme.serendipityText}; font-size: 12px;\"><strong>Serendipity pick:</strong> new territory you may find useful.</p>`
        : "";
      const feedbackLinks = args.feedbackLinksByItemUrl?.[item.url];
      const feedbackActions = feedbackLinks
        ? [
            `<div style=\"margin: 10px 0 0;\">`,
            `<a href=\"${escapeHtml(feedbackLinks.moreLikeThisUrl)}\" style=\"display: inline-block; margin-right: 8px; border: 1px solid ${theme.feedbackMoreBorder}; border-radius: 999px; background: ${theme.feedbackMoreBackground}; color: ${theme.feedbackMoreText}; text-decoration: none; padding: 4px 10px; font-size: 12px;\">More like this</a>`,
            `<a href=\"${escapeHtml(feedbackLinks.lessLikeThisUrl)}\" style=\"display: inline-block; border: 1px solid ${theme.feedbackLessBorder}; border-radius: 999px; background: ${theme.feedbackLessBackground}; color: ${theme.feedbackLessText}; text-decoration: none; padding: 4px 10px; font-size: 12px;\">Less like this</a>`,
            `</div>`
          ].join("\n")
        : "";
      return [
        `<section style=\"margin: 0 0 14px; border: 1px solid ${theme.itemBorder}; background: ${theme.itemBackground}; border-radius: 12px; padding: 14px 16px;\">`,
        `<h3 style=\"margin: 0 0 8px; font-size: 19px; line-height: 1.35; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600;\">`,
        `<a href=\"${escapeHtml(item.url)}\" style=\"color: ${theme.linkText}; text-decoration: underline; text-decoration-color: ${theme.linkDecoration}; text-decoration-thickness: 2px; text-underline-offset: 4px;\">${index + 1}. ${escapeHtml(item.title)}</a>`,
        `</h3>`,
        serendipityNote,
        `<p style=\"margin: 0 0 8px; line-height: 1.6; color: ${theme.bodyText}; font-size: 15px;\">${escapeHtml(item.summary)}</p>`,
        feedbackActions,
        `</section>`
      ].join("\n");
    })
    .join("\n");

  const textItems = args.items
    .map((item, index) => {
      const feedbackLinks = args.feedbackLinksByItemUrl?.[item.url];
      return [
        `${index + 1}. ${item.title}`,
        item.isSerendipitous ? "Serendipity pick: new territory you may find useful." : null,
        item.summary,
        item.url,
        feedbackLinks ? `More like this: ${feedbackLinks.moreLikeThisUrl}` : null,
        feedbackLinks ? `Less like this: ${feedbackLinks.lessLikeThisUrl}` : null
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const quoteHtml = args.quote
    ? [
        `<div style=\"margin: 0 0 14px;\">`,
        `<p style=\"margin: 0 0 8px; color: ${theme.quoteTitle}; font-size: 26px; line-height: 1.15; font-weight: 700; font-family: 'Segoe Script', 'Lucida Handwriting', 'Apple Chancery', cursive;\">Quote of the Day</p>`,
        `<blockquote style=\"margin: 0 0 8px; color: ${theme.quoteBody}; font-size: 18px; line-height: 1.55; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic;\">${escapeHtml(args.quote.text)}</blockquote>`,
        `<p style=\"margin: 0; color: ${theme.quoteAuthor}; font-size: 13px;\">- ${escapeHtml(args.quote.author)}</p>`,
        `</div>`
      ].join("\n")
    : "";

  const quoteText = args.quote ? [`Quote of the Day:`, `"${args.quote.text}"`, `- ${args.quote.author}`, ""].join("\n") : "";

  const html = [
    `<div style=\"font-family: 'Source Sans 3', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; background: ${theme.outerBackground}; color: ${theme.bodyText}; max-width: 720px; margin: 0 auto; padding: 24px;\">`,
    `<div style=\"border: 1px solid ${theme.panelBorder}; background: ${theme.panelBackground}; border-radius: 18px; padding: 20px;\">`,
    `<h2 style=\"margin: 0 0 8px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 34px; line-height: 1.15; color: ${theme.headingText};\">Hi ${escapeHtml(greetingName)},</h2>`,
    variant === "welcome"
      ? `<p style=\"line-height: 1.6; color: ${theme.bodyText}; margin: 0 0 14px;\">Here is your first issue with ${itemCount} curated links.</p>`
      : `<p style=\"line-height: 1.6; color: ${theme.bodyText}; margin: 0 0 14px;\">Here are your ${itemCount} curated links for today.</p>`,
    htmlItems,
    `<hr style=\"margin: 24px 0; border: 0; border-top: 1px solid ${theme.panelBorder};\"/>`,
    quoteHtml,
    `<p style=\"color: ${theme.footerText}; font-size: 14px; margin: 0;\"><strong style=\"font-family: 'Cambria Math', Cambria, Georgia, serif; font-size: 20px; color: ${theme.replyAccent};\">Reply with what you want more or less of, and tomorrow's issue will adapt.</strong></p>`,
    `</div>`,
    `</div>`
  ].join("\n");

  const text = [
    `Hi ${greetingName},`,
    "",
    variant === "welcome" ? `Here is your first issue with ${itemCount} curated links.` : `Here are your ${itemCount} curated links for today.`,
    "",
    textItems,
    "",
    quoteText,
    "Reply with what you want more or less of, and tomorrow's issue will adapt."
  ].join("\n");

  return { subject, html, text };
}
