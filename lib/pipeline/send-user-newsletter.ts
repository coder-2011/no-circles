import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { outboundSendIdempotency, users } from "@/lib/db/schema";
import { runDiscovery, type DiscoveryRunResult } from "@/lib/discovery/run-discovery";
import { getFinalHighlightsByUrl } from "@/lib/discovery/exa-contents";
import {
  addCanonicalUrls,
  encodeBloomBitsBase64,
  maybeRotate,
  mightContainCanonicalUrl,
  normalizeBloomStateFromUserRow,
  type UserBloomState
} from "@/lib/bloom/user-url-bloom";
import { generateNewsletterSummaries, type NewsletterSummaryItem } from "@/lib/summary/writer";
import {
  pickRandomNewsletterThemeTemplate,
  renderNewsletter,
  type NewsletterThemeTemplateKey
} from "@/lib/email/render-newsletter";
import { sendNewsletter } from "@/lib/email/send-newsletter";
import { selectPersonalizedQuote, type PersonalizedQuote } from "@/lib/quotes/select-personalized-quote";
import {
  buildFeedbackClickUrl,
  createFeedbackClickToken,
  resolveFeedbackBaseUrl
} from "@/lib/feedback/click-token";
import {
  buildOutboundIdempotencyKey,
  markOutboundSendIdempotencyFailed,
  reserveOutboundSendIdempotency,
  type ReserveOutboundSendResult
} from "@/lib/send/idempotency";
import { logError, logInfo } from "@/lib/observability/log";

type PipelineStatus = "sent" | "insufficient_content" | "send_failed" | "internal_error";

export type SendUserNewsletterResult = {
  status: PipelineStatus;
  userId: string;
  runAtUtc: string;
  itemCount: number;
  idempotencyKey: string;
  providerMessageId?: string | null;
  error?: string;
};

type PipelineUser = {
  id: string;
  email: string;
  preferredName: string;
  timezone: string;
  interestMemoryText: string;
  sentUrlBloomBits: string | null;
};

type SendPipelineDeps = {
  runDiscoveryFn?: typeof runDiscovery;
  generateSummariesFn?: typeof generateNewsletterSummaries;
  getFinalHighlightsByUrlFn?: typeof getFinalHighlightsByUrl;
  selectQuoteFn?: typeof selectPersonalizedQuote;
  renderNewsletterFn?: typeof renderNewsletter;
  selectThemeTemplateFn?: () => NewsletterThemeTemplateKey;
  sendNewsletterFn?: typeof sendNewsletter;
  loadUserFn?: (userId: string) => Promise<PipelineUser | null>;
  reserveIdempotencyFn?: (args: { userId: string; idempotencyKey: string; localIssueDate: string }) => Promise<ReserveOutboundSendResult>;
  markIdempotencyFailedFn?: (args: { idempotencyKey: string; reason: string }) => Promise<void>;
  persistSendSuccessFn?: (args: {
    userId: string;
    runAtUtc: Date;
    idempotencyKey: string;
    providerMessageId: string | null;
    bloomState: UserBloomState;
  }) => Promise<void>;
};

const DEFAULT_TARGET_ITEM_COUNT = 10;

function logPipeline(event: string, details: Record<string, unknown>) {
  logInfo("send_pipeline", event, details);
}

function loadUserBloomState(user: PipelineUser): UserBloomState {
  return normalizeBloomStateFromUserRow({
    sentUrlBloomBits: user.sentUrlBloomBits
  });
}

async function loadUser(userId: string): Promise<PipelineUser | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      preferredName: users.preferredName,
      timezone: users.timezone,
      interestMemoryText: users.interestMemoryText,
      sentUrlBloomBits: users.sentUrlBloomBits
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function sendUserNewsletter(
  args: {
    userId: string;
    runAtUtc: Date;
    targetItemCount?: number;
    issueVariant?: "daily" | "welcome";
  },
  deps: SendPipelineDeps = {}
): Promise<SendUserNewsletterResult> {
  const runDiscoveryFn = deps.runDiscoveryFn ?? runDiscovery;
  const generateSummariesFn = deps.generateSummariesFn ?? generateNewsletterSummaries;
  const getFinalHighlightsByUrlFn = deps.getFinalHighlightsByUrlFn ?? getFinalHighlightsByUrl;
  const selectQuoteFn = deps.selectQuoteFn ?? selectPersonalizedQuote;
  const renderNewsletterFn = deps.renderNewsletterFn ?? renderNewsletter;
  const selectThemeTemplateFn = deps.selectThemeTemplateFn ?? pickRandomNewsletterThemeTemplate;
  const sendNewsletterFn = deps.sendNewsletterFn ?? sendNewsletter;

  const loadUserFn = deps.loadUserFn ?? loadUser;
  const reserveIdempotencyFn = deps.reserveIdempotencyFn ?? reserveOutboundSendIdempotency;
  const markIdempotencyFailedFn = deps.markIdempotencyFailedFn ?? markOutboundSendIdempotencyFailed;
  const targetItemCount = args.targetItemCount ?? DEFAULT_TARGET_ITEM_COUNT;
  const issueVariant = args.issueVariant ?? "daily";
  const persistSendSuccessFn =
    deps.persistSendSuccessFn ??
    (async (params) => {
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            lastIssueSentAt: params.runAtUtc,
            sentUrlBloomBits: encodeBloomBitsBase64(params.bloomState)
          })
          .where(eq(users.id, params.userId));

        await tx
          .update(outboundSendIdempotency)
          .set({
            status: "sent",
            providerMessageId: params.providerMessageId,
            failureReason: null,
            updatedAt: new Date()
          })
          .where(eq(outboundSendIdempotency.idempotencyKey, params.idempotencyKey));
      });
    });

  const user = await loadUserFn(args.userId);

  if (!user) {
    return {
      status: "internal_error",
      userId: args.userId,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: 0,
      idempotencyKey: "",
      error: "USER_NOT_FOUND"
    };
  }

  const { idempotencyKey, localIssueDate } = buildOutboundIdempotencyKey({
    userId: user.id,
    timezone: user.timezone,
    runAtUtc: args.runAtUtc
  });

  let bloomState = loadUserBloomState(user);
  const rotationResult = maybeRotate(bloomState, { threshold: 0.02 });
  bloomState = rotationResult.state;

  if (rotationResult.rotated) {
    logPipeline("bloom_rotated", {
      user_id: user.id,
      run_at_utc: args.runAtUtc.toISOString(),
      fp_before_rotation: rotationResult.estimatedFalsePositiveRate
    });
  }

  let discovery: DiscoveryRunResult;

  try {
    discovery = await runDiscoveryFn(
      {
        interestMemoryText: user.interestMemoryText,
        targetCount: targetItemCount,
        maxAttempts: 1,
        perTopicResults: 7,
        requireUrlExcerpt: true
      },
      {
        includeCandidate: (candidate) => !mightContainCanonicalUrl(bloomState, candidate.canonicalUrl)
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "DISCOVERY_FAILED";
    const status = message.startsWith("INSUFFICIENT_") || message === "NO_ACTIVE_TOPICS" ? "insufficient_content" : "send_failed";

    return {
      status,
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: 0,
      idempotencyKey,
      error: message
    };
  }

  if (discovery.candidates.length < targetItemCount) {
    return {
      status: "insufficient_content",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: discovery.candidates.length,
      idempotencyKey,
      error: "INSUFFICIENT_CONTENT_AFTER_BLOOM"
    };
  }

  const selectedCandidates = discovery.candidates.slice(0, targetItemCount);

  let highlightsByUrl: Map<string, string[]>;
  try {
    highlightsByUrl = await getFinalHighlightsByUrlFn({
      urls: selectedCandidates.map((candidate) => candidate.url),
      maxCharacters: 4500
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXA_HIGHLIGHTS_FETCH_FAILED";
    return {
      status: "send_failed",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: 0,
      idempotencyKey,
      error: message
    };
  }
  type CandidateWithHighlights = (typeof selectedCandidates)[number] & {
    highlights: string[];
    highlight: string;
  };

  const candidatesWithHighlights = selectedCandidates
    .map((candidate) => {
      const highlights = highlightsByUrl.get(candidate.canonicalUrl);
      if (!highlights || highlights.length === 0) {
        return null;
      }

      const primaryHighlight = highlights[0];
      if (!primaryHighlight) {
        return null;
      }

      return {
        ...candidate,
        highlights,
        highlight: primaryHighlight
      };
    })
    .filter((candidate): candidate is CandidateWithHighlights => candidate !== null);

  if (candidatesWithHighlights.length === 0) {
    return {
      status: "insufficient_content",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: candidatesWithHighlights.length,
      idempotencyKey,
      error: "INSUFFICIENT_EXA_HIGHLIGHTS"
    };
  }

  logPipeline("discovery_completed", {
    user_id: user.id,
    run_at_utc: args.runAtUtc.toISOString(),
    selected_count: selectedCandidates.length,
    selected_with_highlights_count: candidatesWithHighlights.length,
    warnings: discovery.warnings
  });

  const reserveResult = await reserveIdempotencyFn({
    userId: user.id,
    idempotencyKey,
    localIssueDate
  });

  if (reserveResult.outcome === "already_sent" || reserveResult.outcome === "already_processing") {
    logPipeline("idempotency_conflict", {
      user_id: user.id,
      run_at_utc: args.runAtUtc.toISOString(),
      idempotency_key: idempotencyKey,
      existing_status: reserveResult.status,
      outcome: reserveResult.outcome
    });

    if (reserveResult.outcome === "already_sent") {
      return {
        status: "sent",
        userId: user.id,
        runAtUtc: args.runAtUtc.toISOString(),
        itemCount: 0,
        idempotencyKey,
        providerMessageId: reserveResult.providerMessageId
      };
    }

    return {
      status: "send_failed",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: 0,
      idempotencyKey,
      error: "IDEMPOTENCY_ALREADY_PROCESSING"
    };
  }

  let summaries: NewsletterSummaryItem[];
  const serendipityTopicSet = new Set(discovery.serendipityTopics ?? []);
  const summaryInputCandidates = candidatesWithHighlights.slice(0, targetItemCount);

  try {
    summaries = await generateSummariesFn({
      items: summaryInputCandidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title ?? "Untitled",
        highlights: candidate.highlights,
        topic: candidate.topic,
        isSerendipitous: serendipityTopicSet.has(candidate.topic)
      })),
      targetWords: 100
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SUMMARY_FAILED";
    await markIdempotencyFailedFn({ idempotencyKey, reason: message });

    return {
      status: "send_failed",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: 0,
      idempotencyKey,
      error: message
    };
  }

  if (summaries.length === 0) {
    await markIdempotencyFailedFn({
      idempotencyKey,
      reason: "SUMMARY_EMPTY_AFTER_CONTEXT_FILTER"
    });

    return {
      status: "insufficient_content",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: summaries.length,
      idempotencyKey,
      error: "SUMMARY_EMPTY_AFTER_CONTEXT_FILTER"
    };
  }

  let quote: PersonalizedQuote | null = null;
  try {
    quote = await selectQuoteFn({
      userId: user.id,
      localIssueDate,
      interestMemoryText: user.interestMemoryText,
      candidateCount: 50,
      shortlistCount: 20
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QUOTE_SELECTION_FAILED";
    logError("send_pipeline", "quote_selection_failed", {
      user_id: user.id,
      run_at_utc: args.runAtUtc.toISOString(),
      error: message
    });
  }

  const selectedThemeTemplate = selectThemeTemplateFn();

  const rendered = renderNewsletterFn({
    preferredName: user.preferredName,
    timezone: user.timezone,
    runAtUtc: args.runAtUtc,
    items: summaries,
    feedbackLinksByItemUrl: (() => {
      const secret = process.env.FEEDBACK_LINK_SECRET?.trim();
      const baseUrl = resolveFeedbackBaseUrl();
      if (!secret || !baseUrl) {
        if (!secret) {
          logPipeline("feedback_links_disabled_missing_secret", {
            user_id: user.id,
            run_at_utc: args.runAtUtc.toISOString()
          });
        }

        if (!baseUrl) {
          logPipeline("feedback_links_disabled_missing_base_url", {
            user_id: user.id,
            run_at_utc: args.runAtUtc.toISOString()
          });
        }

        return undefined;
      }

      const linksByUrl: Record<string, { moreLikeThisUrl: string; lessLikeThisUrl: string }> = {};
      for (let index = 0; index < summaries.length; index += 1) {
        const summary = summaries[index];
        if (!summary) {
          continue;
        }

        const moreLikeToken = createFeedbackClickToken({
          userId: user.id,
          url: summary.url,
          title: summary.title,
          feedbackType: "more_like_this",
          secret
        });
        const lessLikeToken = createFeedbackClickToken({
          userId: user.id,
          url: summary.url,
          title: summary.title,
          feedbackType: "less_like_this",
          secret
        });

        linksByUrl[summary.url] = {
          moreLikeThisUrl: buildFeedbackClickUrl({ baseUrl, token: moreLikeToken }),
          lessLikeThisUrl: buildFeedbackClickUrl({ baseUrl, token: lessLikeToken })
        };
      }

      return linksByUrl;
    })(),
    quote,
    variant: issueVariant,
    themeTemplate: selectedThemeTemplate
  });

  const sendResult = await sendNewsletterFn({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey
  });

  if (!sendResult.ok) {
    const reason = sendResult.error ?? "SEND_PROVIDER_FAILURE";
    await markIdempotencyFailedFn({ idempotencyKey, reason });

    logPipeline("send_failed", {
      user_id: user.id,
      run_at_utc: args.runAtUtc.toISOString(),
      attempts: sendResult.attempts,
      reason
    });

    return {
      status: "send_failed",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: summaries.length,
      idempotencyKey,
      error: reason
    };
  }

  const sentCanonicalUrls = summaryInputCandidates.map((candidate) => candidate.canonicalUrl);
  const bloomAfterSend = addCanonicalUrls(bloomState, sentCanonicalUrls);

  try {
    await persistSendSuccessFn({
      userId: user.id,
      runAtUtc: args.runAtUtc,
      idempotencyKey,
      providerMessageId: sendResult.providerMessageId,
      bloomState: bloomAfterSend
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POST_SEND_DB_UPDATE_FAILED";
    await markIdempotencyFailedFn({ idempotencyKey, reason: message });

    logError("send_pipeline", "post_send_db_update_failed", {
      user_id: user.id,
      run_at_utc: args.runAtUtc.toISOString(),
      idempotency_key: idempotencyKey,
      error: message
    });

    return {
      status: "send_failed",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: summaries.length,
      idempotencyKey,
      providerMessageId: sendResult.providerMessageId,
      error: message
    };
  }

  logPipeline("sent", {
    user_id: user.id,
    run_at_utc: args.runAtUtc.toISOString(),
    item_count: summaries.length,
    issue_variant: issueVariant,
    theme_template: selectedThemeTemplate,
    provider_message_id: sendResult.providerMessageId,
    bloom_count_estimate: bloomAfterSend.count
  });

  return {
    status: "sent",
    userId: user.id,
    runAtUtc: args.runAtUtc.toISOString(),
    itemCount: summaries.length,
    idempotencyKey,
    providerMessageId: sendResult.providerMessageId
  };
}
