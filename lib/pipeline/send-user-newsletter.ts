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
import { renderNewsletter } from "@/lib/email/render-newsletter";
import { sendNewsletter } from "@/lib/email/send-newsletter";
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
  renderNewsletterFn?: typeof renderNewsletter;
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
  const renderNewsletterFn = deps.renderNewsletterFn ?? renderNewsletter;
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
        maxRetries: 1,
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

  if (candidatesWithHighlights.length < targetItemCount) {
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
        itemCount: targetItemCount,
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

  try {
    summaries = await generateSummariesFn({
      items: candidatesWithHighlights.map((candidate) => ({
        url: candidate.url,
        title: candidate.title ?? "Untitled",
        highlights: candidate.highlights,
        topic: candidate.topic
      })),
      targetWords: 50
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

  if (summaries.length !== targetItemCount) {
    await markIdempotencyFailedFn({
      idempotencyKey,
      reason: `SUMMARY_COUNT_MISMATCH:${summaries.length}/${targetItemCount}`
    });

    return {
      status: "insufficient_content",
      userId: user.id,
      runAtUtc: args.runAtUtc.toISOString(),
      itemCount: summaries.length,
      idempotencyKey,
      error: "SUMMARY_COUNT_MISMATCH"
    };
  }

  const rendered = renderNewsletterFn({
    preferredName: user.preferredName,
    timezone: user.timezone,
    runAtUtc: args.runAtUtc,
    items: summaries,
    variant: issueVariant
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
      itemCount: targetItemCount,
      idempotencyKey,
      error: reason
    };
  }

  const sentCanonicalUrls = selectedCandidates.map((candidate) => candidate.canonicalUrl);
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
      itemCount: targetItemCount,
      idempotencyKey,
      providerMessageId: sendResult.providerMessageId,
      error: message
    };
  }

  logPipeline("sent", {
    user_id: user.id,
    run_at_utc: args.runAtUtc.toISOString(),
    item_count: targetItemCount,
    issue_variant: issueVariant,
    provider_message_id: sendResult.providerMessageId,
    bloom_count_estimate: bloomAfterSend.count
  });

  return {
    status: "sent",
    userId: user.id,
    runAtUtc: args.runAtUtc.toISOString(),
    itemCount: targetItemCount,
    idempotencyKey,
    providerMessageId: sendResult.providerMessageId
  };
}
