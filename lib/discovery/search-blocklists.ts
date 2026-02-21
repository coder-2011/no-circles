import type { ExaSearchResult } from "@/lib/discovery/types";

type CompiledMatchers = {
  domainSuffixes: Set<string>;
  regexes: RegExp[];
};

const BLOCKLIST_FETCH_TIMEOUT_MS = 8000;
const BLOCKLIST_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const DEFAULT_BLOCKLIST_SUBSCRIPTION_URLS = [
  "https://raw.githubusercontent.com/rjaus/ublacklist-pinterest/main/ublacklist-pinterest.txt",
  "https://raw.githubusercontent.com/arosh/ublacklist-github-translation/master/uBlacklist.txt",
  "https://raw.githubusercontent.com/arosh/ublacklist-stackoverflow-translation/master/uBlacklist.txt",
  "https://raw.githubusercontent.com/quenhus/uBlock-Origin-dev-filter/main/dist/other_format/uBlacklist/all.txt",
  "https://raw.githubusercontent.com/franga2000/aliexpress-fake-sites/main/domains_uBlacklist.txt",
  "https://raw.githubusercontent.com/rjaus/ublacklist-yelp/main/ublacklist-yelp.txt",
  "https://raw.githubusercontent.com/wdmpa/content-farm-list/main/uBlacklist.txt",
  "https://raw.githubusercontent.com/agsimmons/ai-content-blocklist/refs/heads/main/uBlacklist.txt",
  "https://api.stopmodreposts.org/ublacklist.txt",
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/main/filterlist-wildcard-urls.txt",
  "https://raw.githubusercontent.com/ngoomie/uBlacklist-suspicious-downloads/main/list.txt",
  "https://raw.githubusercontent.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist/main/list_uBlacklist.txt",
  "https://raw.githubusercontent.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist/main/list_uBlacklist_nuclear.txt",
  "https://raw.githubusercontent.com/popcar2/BadWebsiteBlocklist/refs/heads/main/uBlacklist.txt",
  "https://raw.githubusercontent.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist/main/list.txt"
] as const;

let cachedMatchers: CompiledMatchers | null = null;
let cachedAt = 0;
let inflightLoad: Promise<CompiledMatchers> | null = null;
let cachedSubscriptionsKey: string | null = null;

function normalizeDomain(value: string): string | null {
  const normalized = value.toLowerCase().trim().replace(/^www\./, "").replace(/\.$/, "");
  if (!normalized || /\s/.test(normalized)) return null;
  if (!/[a-z0-9-]+\.[a-z]{2,}$/i.test(normalized)) return null;
  return normalized;
}

function wildcardToRegex(pattern: string): RegExp | null {
  const normalized = pattern.trim();
  if (!normalized) return null;
  const escaped = normalized
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  try {
    return new RegExp(`^${escaped}$`, "i");
  } catch {
    return null;
  }
}

function parseRegexRule(rawRule: string): RegExp | null {
  const trimmed = rawRule.trim();
  if (!trimmed.startsWith("/") || trimmed.length < 2) return null;
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash <= 0) return null;

  const body = trimmed.slice(1, lastSlash);
  const flagsRaw = trimmed.slice(lastSlash + 1);
  const flags = flagsRaw.replace(/[^dgimsuvy]/g, "");
  if (!body.trim()) return null;

  try {
    return new RegExp(body, flags || "i");
  } catch {
    return null;
  }
}

function parseAdblockDomainRule(rawRule: string): string | null {
  if (!rawRule.startsWith("||")) return null;
  const body = rawRule.slice(2).split(/[/$^]/, 1)[0] ?? "";
  return normalizeDomain(body.replace(/^\*\./, ""));
}

function parseHostsRule(rawRule: string): string | null {
  const parts = rawRule.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const host = parts[0];
  if (host !== "0.0.0.0" && host !== "127.0.0.1") return null;
  return normalizeDomain(parts[1] ?? "");
}

function parsePlainDomainRule(rawRule: string): string | null {
  const normalized = rawRule.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  return normalizeDomain(normalized);
}

function addRuleToMatchers(rawLine: string, matchers: CompiledMatchers) {
  const line = rawLine.trim();
  if (!line) return;
  if (line.startsWith("#") || line.startsWith("!") || line.startsWith("[")) return;
  if (line.startsWith("@@")) return;

  const regexRule = parseRegexRule(line);
  if (regexRule) {
    matchers.regexes.push(regexRule);
    return;
  }

  const adblockDomain = parseAdblockDomainRule(line);
  if (adblockDomain) {
    matchers.domainSuffixes.add(adblockDomain);
    return;
  }

  const hostsDomain = parseHostsRule(line);
  if (hostsDomain) {
    matchers.domainSuffixes.add(hostsDomain);
    return;
  }

  if (line.includes("://") || line.includes("*")) {
    const regexFromWildcard = wildcardToRegex(line);
    if (regexFromWildcard) {
      matchers.regexes.push(regexFromWildcard);
      return;
    }
  }

  const plainDomain = parsePlainDomainRule(line);
  if (plainDomain) {
    matchers.domainSuffixes.add(plainDomain);
  }
}

function isBlockedByDomain(hostname: string, domainSuffixes: Set<string>): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  for (const suffix of domainSuffixes) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return true;
    }
  }
  return false;
}

function resolveSubscriptionUrls(): string[] {
  const override = process.env.DISCOVERY_SEARCH_BLOCKLIST_SUBSCRIPTIONS?.trim();
  if (!override) {
    return [...DEFAULT_BLOCKLIST_SUBSCRIPTION_URLS];
  }

  const entries = override
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : [...DEFAULT_BLOCKLIST_SUBSCRIPTION_URLS];
}

async function fetchBlocklist(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BLOCKLIST_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return "";
    }
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function loadMatchers(): Promise<CompiledMatchers> {
  const urls = resolveSubscriptionUrls();
  const subscriptionsKey = urls.join(",");
  const now = Date.now();
  if (cachedMatchers && cachedSubscriptionsKey === subscriptionsKey && now - cachedAt < BLOCKLIST_CACHE_TTL_MS) {
    return cachedMatchers;
  }

  if (inflightLoad) {
    return inflightLoad;
  }

  inflightLoad = (async () => {
    const bodies = await Promise.all(urls.map((url) => fetchBlocklist(url)));
    const nextMatchers: CompiledMatchers = { domainSuffixes: new Set<string>(), regexes: [] };

    for (const body of bodies) {
      if (!body) continue;
      const lines = body.split(/\r?\n/);
      for (const line of lines) {
        addRuleToMatchers(line, nextMatchers);
      }
    }

    cachedMatchers = nextMatchers;
    cachedSubscriptionsKey = subscriptionsKey;
    cachedAt = Date.now();
    return nextMatchers;
  })();

  try {
    return await inflightLoad;
  } finally {
    inflightLoad = null;
  }
}

function isBlockedUrl(rawUrl: string, matchers: CompiledMatchers): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (isBlockedByDomain(parsed.hostname, matchers.domainSuffixes)) {
    return true;
  }

  const normalizedUrl = parsed.toString();
  for (const regex of matchers.regexes) {
    if (regex.test(normalizedUrl)) {
      return true;
    }
  }

  return false;
}

export async function filterBlockedSearchResults(results: ExaSearchResult[]): Promise<ExaSearchResult[]> {
  if (results.length === 0) return results;
  const matchers = await loadMatchers();
  if (matchers.domainSuffixes.size === 0 && matchers.regexes.length === 0) {
    return results;
  }

  return results.filter((result) => !isBlockedUrl(result.url, matchers));
}
