import type { ExaSearchResult } from "@/lib/discovery/types";
import { getPaywallDomainSignal, type PaywallDomainSignal } from "@/lib/discovery/paywall-domain-corpus";

const PAYWALL_BLOCK_THRESHOLD = 65;
const PAYWALL_PATH_HINT = /\/(?:subscribe|subscription|subscriber|premium|paywall|membership|gateway|checkout|login|register|account)(?:\/|$|[?#-])/i;
const PAYWALL_VENDOR_PATTERNS = [
  /tinypass/i,
  /piano\.io/i,
  /pelcro/i,
  /zephr/i,
  /laterpay/i,
  /poool/i
] as const;
const PAYWALL_MARKUP_PATTERNS = [
  /\bpaywall\b/i,
  /\bregwall\b/i,
  /\bsubscriber[-_\s]?only\b/i,
  /\bpremium[-_\s]?content\b/i,
  /\bgateway[-_\s]?content\b/i,
  /\bmetered(?:[-_\s]paywall)?\b/i
] as const;
const PAYWALL_COPY_PATTERNS = [
  /subscribe to continue reading/i,
  /subscribe to keep reading/i,
  /sign in to continue reading/i,
  /already a subscriber/i,
  /subscriber-only/i,
  /unlock this article/i,
  /start your subscription/i,
  /remaining articles/i,
  /create an account to continue reading/i,
  /unlimited digital access/i
] as const;

export type PaywallAssessment = {
  blocked: boolean;
  score: number;
  reasons: string[];
  domainSignal: PaywallDomainSignal;
  matchedCopyPhrases: number;
};

function extractHtmlLower(html: string | null | undefined): string {
  return typeof html === "string" ? html.toLowerCase() : "";
}

function countMatches(patterns: readonly RegExp[], value: string): number {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(value)) {
      count += 1;
    }
  }
  return count;
}

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of matches) {
    const block = match[1]?.trim();
    if (block) {
      blocks.push(block);
    }
  }
  return blocks;
}

function hasStructuredPaywallSignal(node: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some((item) => hasStructuredPaywallSignal(item));
  }

  if (!node || typeof node !== "object") {
    return false;
  }

  const record = node as Record<string, unknown>;
  const accessible = record.isAccessibleForFree;
  if (accessible === false || String(accessible).toLowerCase() === "false") {
    return true;
  }

  const type = String(record["@type"] ?? "").toLowerCase();
  if (type === "webpageelement" && typeof record.cssSelector === "string" && record.cssSelector.trim()) {
    return true;
  }

  return Object.values(record).some((value) => hasStructuredPaywallSignal(value));
}

function detectStructuredDataPaywall(html: string | null | undefined): boolean {
  if (!html) return false;

  for (const block of extractJsonLdBlocks(html)) {
    try {
      const parsed = JSON.parse(block) as unknown;
      if (hasStructuredPaywallSignal(parsed)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

function buildReasonsList(args: {
  domainSignal: PaywallDomainSignal;
  urlPathHit: boolean;
  structuredDataHit: boolean;
  vendorHits: number;
  markupHits: number;
  copyHits: number;
  abruptExcerptHit: boolean;
}): string[] {
  const reasons: string[] = [];

  if (args.domainSignal.source !== "none") {
    reasons.push(`domain:${args.domainSignal.source}`);
  }
  if (args.urlPathHit) {
    reasons.push("path:premium_hint");
  }
  if (args.structuredDataHit) {
    reasons.push("html:structured_data");
  }
  if (args.vendorHits > 0) {
    reasons.push(`html:vendor:${args.vendorHits}`);
  }
  if (args.markupHits > 0) {
    reasons.push(`html:markup:${args.markupHits}`);
  }
  if (args.copyHits > 0) {
    reasons.push(`text:paywall_copy:${args.copyHits}`);
  }
  if (args.abruptExcerptHit) {
    reasons.push("excerpt:abrupt_short");
  }

  return reasons;
}

export function assessPaywallRisk(args: {
  url: string;
  finalUrl?: string | null;
  html?: string | null;
  excerpt?: string | null;
}): PaywallAssessment {
  const domainSignal = getPaywallDomainSignal(args.finalUrl ?? args.url);
  if (domainSignal.allowed) {
    return {
      blocked: false,
      score: 0,
      reasons: [`domain:${domainSignal.source}`],
      domainSignal,
      matchedCopyPhrases: 0
    };
  }

  if (domainSignal.blocked) {
    return {
      blocked: true,
      score: 100,
      reasons: [`domain:${domainSignal.source}`],
      domainSignal,
      matchedCopyPhrases: 0
    };
  }

  const htmlLower = extractHtmlLower(args.html);
  const excerptLower = (args.excerpt ?? "").toLowerCase();
  const pathTarget = args.finalUrl ?? args.url;
  const urlPathHit = PAYWALL_PATH_HINT.test(pathTarget);
  const structuredDataHit = detectStructuredDataPaywall(args.html);
  const vendorHits = countMatches(PAYWALL_VENDOR_PATTERNS, htmlLower);
  const markupHits = countMatches(PAYWALL_MARKUP_PATTERNS, htmlLower);
  const copyHits = countMatches(PAYWALL_COPY_PATTERNS, `${htmlLower}\n${excerptLower}`);
  const abruptExcerptHit = copyHits > 0 && excerptLower.length > 0 && excerptLower.length < 450;

  let score = domainSignal.score;
  if (urlPathHit) score += 45;
  if (structuredDataHit) score += 100;
  if (vendorHits > 0) score += 45;
  if (markupHits > 0) score += 25;
  if (copyHits > 0) score += copyHits >= 2 ? 35 : 25;
  if (abruptExcerptHit) score += 15;

  return {
    blocked: score >= PAYWALL_BLOCK_THRESHOLD,
    score,
    reasons: buildReasonsList({
      domainSignal,
      urlPathHit,
      structuredDataHit,
      vendorHits,
      markupHits,
      copyHits,
      abruptExcerptHit
    }),
    domainSignal,
    matchedCopyPhrases: copyHits
  };
}

export function filterLikelyPaywalledSearchResults(results: ExaSearchResult[]): {
  kept: ExaSearchResult[];
  filtered: Array<{ result: ExaSearchResult; assessment: PaywallAssessment }>;
} {
  const kept: ExaSearchResult[] = [];
  const filtered: Array<{ result: ExaSearchResult; assessment: PaywallAssessment }> = [];

  for (const result of results) {
    const assessment = assessPaywallRisk({ url: result.url });
    if (assessment.blocked) {
      filtered.push({ result, assessment });
      continue;
    }
    kept.push(result);
  }

  return { kept, filtered };
}
