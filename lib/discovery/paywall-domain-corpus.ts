import corpus from "@/lib/discovery/paywall-domain-corpus.generated.json";

export type PaywallDomainSource =
  | "none"
  | "blocked_override"
  | "allowed_override"
  | "bpc_default"
  | "bpc_updated"
  | "bpc_custom";

export type PaywallDomainSignal = {
  hostname: string | null;
  source: PaywallDomainSource;
  score: number;
  blocked: boolean;
  allowed: boolean;
};

function normalizeDomain(value: string): string | null {
  const normalized = value.toLowerCase().trim().replace(/^www\./, "").replace(/\.$/, "");
  if (!normalized || /\s/.test(normalized)) return null;
  if (!/[a-z0-9-]+\.[a-z]{2,}$/i.test(normalized)) return null;
  return normalized;
}

function parseDomainList(rawValue: string | undefined): Set<string> {
  if (!rawValue?.trim()) return new Set<string>();

  return new Set(
    rawValue
      .split(",")
      .map((entry) => normalizeDomain(entry))
      .filter((entry): entry is string => Boolean(entry))
  );
}

function resolveHostname(urlOrHostname: string): string | null {
  const trimmed = urlOrHostname.trim();
  if (!trimmed) return null;

  try {
    return normalizeDomain(new URL(trimmed).hostname);
  } catch {
    return normalizeDomain(trimmed.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""));
  }
}

const blockedOverrides = parseDomainList(process.env.DISCOVERY_PAYWALL_BLOCK_DOMAINS);
const allowedOverrides = parseDomainList(process.env.DISCOVERY_PAYWALL_ALLOW_DOMAINS);

const defaultDomains = new Set<string>(corpus.defaultDomains);
const updatedDomains = new Set<string>(corpus.updatedDomains);
const customDomains = new Set<string>(corpus.customDomains);
const combinedDomains = new Set<string>(corpus.combinedDomains);

export function getPaywallDomainSignal(urlOrHostname: string): PaywallDomainSignal {
  const hostname = resolveHostname(urlOrHostname);
  if (!hostname) {
    return {
      hostname: null,
      source: "none",
      score: 0,
      blocked: false,
      allowed: false
    };
  }

  if (allowedOverrides.has(hostname)) {
    return {
      hostname,
      source: "allowed_override",
      score: -100,
      blocked: false,
      allowed: true
    };
  }

  if (blockedOverrides.has(hostname)) {
    return {
      hostname,
      source: "blocked_override",
      score: 100,
      blocked: true,
      allowed: false
    };
  }

  if (updatedDomains.has(hostname)) {
    return {
      hostname,
      source: "bpc_updated",
      score: 30,
      blocked: false,
      allowed: false
    };
  }

  if (defaultDomains.has(hostname)) {
    return {
      hostname,
      source: "bpc_default",
      score: 25,
      blocked: false,
      allowed: false
    };
  }

  if (customDomains.has(hostname)) {
    return {
      hostname,
      source: "bpc_custom",
      score: 15,
      blocked: false,
      allowed: false
    };
  }

  return {
    hostname,
    source: "none",
    score: 0,
    blocked: false,
    allowed: false
  };
}

export function isKnownPaywallDomain(urlOrHostname: string): boolean {
  const hostname = resolveHostname(urlOrHostname);
  return hostname !== null && combinedDomains.has(hostname);
}

export function getPaywallCorpusCounts() {
  return {
    defaultDomains: corpus.counts.defaultDomains,
    updatedDomains: corpus.counts.updatedDomains,
    customDomains: corpus.counts.customDomains,
    combinedDomains: corpus.counts.combinedDomains
  };
}
