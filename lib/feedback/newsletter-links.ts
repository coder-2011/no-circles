import {
  buildFeedbackClickUrl,
  createFeedbackClickToken
} from "@/lib/feedback/click-token";
import type { NewsletterSummaryItem } from "@/lib/summary/writer";

export type NewsletterFeedbackLinks = Record<
  string,
  { moreLikeThisUrl: string; lessLikeThisUrl: string }
>;

export function buildNewsletterFeedbackLinks(args: {
  userId: string;
  items: NewsletterSummaryItem[];
  secret: string | null;
  baseUrl: string | null;
}): {
  linksByUrl: NewsletterFeedbackLinks | undefined;
  missingSecret: boolean;
  missingBaseUrl: boolean;
} {
  const secret = args.secret;
  const baseUrl = args.baseUrl;
  const missingSecret = !secret;
  const missingBaseUrl = !baseUrl;

  if (missingSecret || missingBaseUrl) {
    return {
      linksByUrl: undefined,
      missingSecret,
      missingBaseUrl
    };
  }

  const linksByUrl: NewsletterFeedbackLinks = {};
  for (let index = 0; index < args.items.length; index += 1) {
    const item = args.items[index];
    if (!item) {
      continue;
    }

    const moreLikeToken = createFeedbackClickToken({
      userId: args.userId,
      url: item.url,
      title: item.title,
      feedbackType: "more_like_this",
      secret
    });
    const lessLikeToken = createFeedbackClickToken({
      userId: args.userId,
      url: item.url,
      title: item.title,
      feedbackType: "less_like_this",
      secret
    });

    linksByUrl[item.url] = {
      moreLikeThisUrl: buildFeedbackClickUrl({ baseUrl, token: moreLikeToken }),
      lessLikeThisUrl: buildFeedbackClickUrl({ baseUrl, token: lessLikeToken })
    };
  }

  return {
    linksByUrl,
    missingSecret: false,
    missingBaseUrl: false
  };
}
